pragma solidity 0.6.8;
pragma experimental ABIEncoderV2;

/**
 * @title Bytes32ToString
 *
 * Library that defines a helper function to convert bytes32 to human readable hex string notation 
 */
library Bytes32ToString {
    // ============ Functions ============

    function bytes32ToString(bytes32 _bytes32) external pure returns (string memory) {
        uint8 i = 0;
        bytes memory bytesArray = new bytes(64);
        for (i = 0; i < bytesArray.length; i++) {

            uint8 _f = uint8(_bytes32[i/2] & 0x0f);
            uint8 _l = uint8(_bytes32[i/2] >> 4);

            bytesArray[i] = _toByte(_l);
            i = i + 1;
            bytesArray[i] = _toByte(_f);
        }
        return string(bytesArray);
    }

    function _toByte(uint8 _uint8) private pure returns (byte) {
        if(_uint8 < 10) {
            return byte(_uint8 + 48);
        } else {
            return byte(_uint8 + 87);
        }
    }
}
