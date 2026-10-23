"""Import-only shim for the native ``bitarray`` module.

Smart App Control on this machine blocks the unsigned ``bitarray._bitarray``
native DLL, which breaks ``eth_account`` (and thus ``web3``/``genlayer_py``)
imports. The only consumer in this dependency chain is
``eth_account.hdaccount.mnemonic`` (BIP39 helpers), which these tests never
invoke. Prepend this directory to ``PYTHONPATH`` to run the test suite.
"""


class bitarray:
    def __init__(self, *args, **kwargs):
        raise NotImplementedError(
            "bitarray shim: native module unavailable on this machine"
        )
