import queue
import re
import threading
import time
from contextlib import contextmanager

import pymysql
from flask import current_app
from pymysql.cursors import DictCursor

DB_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


class Database:
    def __init__(self, conn):
        self.conn = conn

    def one(self, sql, params=None):
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.fetchone()

    def all(self, sql, params=None):
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return list(cursor.fetchall())

    def execute(self, sql, params=None):
        with self.conn.cursor() as cursor:
            cursor.execute(sql, params or ())
            return cursor.lastrowid, cursor.rowcount


def validate_db_name(name):
    if not name or not DB_NAME_RE.match(name):
        raise RuntimeError("Database name contains unsupported characters")
    return name


_POOLS = {}
_POOLS_LOCK = threading.Lock()


def _session_setup():
    return (
        "SET time_zone = '+00:00', "
        "sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION', "
        "group_concat_max_len = 8192"
    )


def connect(database=None):
    config = current_app.config
    name = validate_db_name(database or config["DATABASE_NAME"])
    return pymysql.connect(
        host=config["DATABASE_HOST"],
        port=int(config["DATABASE_PORT"]),
        user=config["DATABASE_USER"],
        password=config["DATABASE_PASSWORD"],
        database=name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        init_command=_session_setup(),
        connect_timeout=5,
        read_timeout=10,
        write_timeout=10,
    )


def _pool_for(database=None):
    config = current_app.config
    name = validate_db_name(database or config["DATABASE_NAME"])
    key = (
        config["DATABASE_HOST"],
        int(config["DATABASE_PORT"]),
        config["DATABASE_USER"],
        config["DATABASE_PASSWORD"],
        name,
    )
    with _POOLS_LOCK:
        pool = _POOLS.get(key)
        if pool is None:
            pool = _ConnectionPool(key, max_size=int(config.get("DATABASE_POOL_SIZE", 8)))
            _POOLS[key] = pool
    return pool


class _ConnectionPool:
    """Reuse remote MySQL connections so catalogue reads skip the login handshake."""

    def __init__(self, key, max_size):
        self.key = key
        self.max_size = max_size
        self.idle = queue.LifoQueue(max_size)
        self.size = 0
        self.lock = threading.Lock()

    def checkout(self):
        while True:
            try:
                conn = self.idle.get_nowait()
            except queue.Empty:
                break
            try:
                # A ping is its own trip to the remote database. Skip it while the
                # connection was used moments ago; a dead connection fails the query
                # and is discarded.
                idle_for = time.monotonic() - getattr(conn, "_tiara_used", 0.0)
                if idle_for > 20:
                    conn.ping(reconnect=True)
                return conn, False
            except Exception:
                self._drop(conn)
        with self.lock:
            if self.size < self.max_size:
                self.size += 1
                overflow = False
            else:
                overflow = True
        try:
            return connect(self.key[4]), overflow
        except Exception:
            if not overflow:
                with self.lock:
                    self.size -= 1
            raise

    def release(self, conn, overflow, broken):
        if broken or overflow:
            try:
                conn.close()
            except Exception:
                pass
            if not overflow:
                with self.lock:
                    self.size = max(0, self.size - 1)
            return
        try:
            conn.rollback()
            conn._tiara_used = time.monotonic()
            self.idle.put_nowait(conn)
        except Exception:
            self._drop(conn)

    def _drop(self, conn):
        try:
            conn.close()
        except Exception:
            pass
        with self.lock:
            self.size = max(0, self.size - 1)


def connect_server():
    config = current_app.config
    return pymysql.connect(
        host=config["DATABASE_HOST"],
        port=int(config["DATABASE_PORT"]),
        user=config["DATABASE_USER"],
        password=config["DATABASE_PASSWORD"],
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
        connect_timeout=5,
    )


@contextmanager
def db_session():
    pool = _pool_for()
    conn, overflow = pool.checkout()
    broken = False
    try:
        yield Database(conn)
        conn.commit()
    except Exception:
        broken = True
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        pool.release(conn, overflow, broken)
