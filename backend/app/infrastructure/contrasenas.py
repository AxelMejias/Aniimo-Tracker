from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError


class HasherArgon2:
    def __init__(
        self,
        time_cost: int = 3,
        memory_cost: int = 65536,
        parallelism: int = 4,
    ) -> None:
        self._hasher = PasswordHasher(
            time_cost=time_cost, memory_cost=memory_cost, parallelism=parallelism
        )

    def hashear(self, contrasena: str) -> str:
        return self._hasher.hash(contrasena)

    def verificar(self, contrasena: str, hash_guardado: str) -> bool:
        try:
            return self._hasher.verify(hash_guardado, contrasena)
        except (VerificationError, InvalidHashError):
            return False

    def necesita_rehash(self, hash_guardado: str) -> bool:
        try:
            return self._hasher.check_needs_rehash(hash_guardado)
        except InvalidHashError:
            return True
