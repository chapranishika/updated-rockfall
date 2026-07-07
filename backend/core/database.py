import os
import logging
from motor.motor_asyncio import AsyncIOMotorClient

log = logging.getLogger(__name__)

# Config
MONGO_HOST = os.getenv("MONGO_HOST", "localhost")
MONGO_PORT = os.getenv("MONGO_PORT", "27017")
MONGO_USER = os.getenv("MONGO_USER", "rockfall")
MONGO_PASSWORD = os.getenv("MONGO_PASSWORD", "changeme")

# Formulate URI
if MONGO_USER and MONGO_PASSWORD:
    MONGO_URI = f"mongodb://{MONGO_USER}:{MONGO_PASSWORD}@{MONGO_HOST}:{MONGO_PORT}/?authSource=admin"
else:
    MONGO_URI = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"

class MongoDBManager:
    _instance = None

    def __init__(self):
        self.client = None
        self.db = None
        self.enabled = False
        self._init_conn()

    @classmethod
    def get(cls) -> "MongoDBManager":
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def _init_conn(self):
        try:
            log.info(f"Connecting to MongoDB at {MONGO_HOST}:{MONGO_PORT}...")
            self.client = AsyncIOMotorClient(MONGO_URI, serverSelectionTimeoutMS=2000)
            self.db = self.client["rockfall_ai"]
            self.enabled = True
            log.info("MongoDB client initialized.")
        except Exception as e:
            log.error(f"Failed to initialize MongoDB client: {e}")
            self.enabled = False

    async def save_tourist_record(self, record: dict):
        if not self.enabled or self.db is None:
            log.warning("MongoDB is disabled or not initialized. Skipping record save.")
            return False
        try:
            # Verify database is reachable
            await self.client.admin.command('ping')
            collection = self.db["tourist_records"]
            await collection.insert_one(record)
            log.info("Successfully saved tourist record to MongoDB.")
            return True
        except Exception as e:
            if "AuthenticationFailed" in str(e) or "auth failed" in str(e).lower():
                log.warning("MongoDB authentication failed. Attempting fallback to non-authenticated connection...")
                try:
                    fallback_uri = f"mongodb://{MONGO_HOST}:{MONGO_PORT}/"
                    fallback_client = AsyncIOMotorClient(fallback_uri, serverSelectionTimeoutMS=2000)
                    await fallback_client.admin.command('ping')
                    self.client = fallback_client
                    self.db = self.client["rockfall_ai"]
                    collection = self.db["tourist_records"]
                    await collection.insert_one(record)
                    log.info("Successfully saved tourist record to MongoDB (via fallback non-auth connection).")
                    return True
                except Exception as fallback_e:
                    log.error(f"MongoDB fallback connection also failed: {fallback_e}")
            
            log.error(f"Failed to save tourist record to MongoDB: {e}")
            return False

    async def get_tourist_records(self, limit: int = 50):
        if not self.enabled or self.db is None:
            return []
        try:
            collection = self.db["tourist_records"]
            cursor = collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            log.error(f"Failed to fetch tourist records: {e}")
            return []
