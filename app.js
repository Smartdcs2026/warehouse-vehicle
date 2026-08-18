/* QR encoder adapted from Kazuhiko Arase QRCode for JavaScript (MIT). */
(function(global){
"use strict";
const __mods={},__cache={};
__mods["QR8bitByte"]=function(module,exports,__req){
var QRMode = __req("QRMode");

function QR8bitByte(data) {
	this.mode = QRMode.MODE_8BIT_BYTE;
	this.data = data;
}

QR8bitByte.prototype = {

	getLength : function() {
		return this.data.length;
	},
	
	write : function(buffer) {
		for (var i = 0; i < this.data.length; i++) {
			// not JIS ...
			buffer.put(this.data.charCodeAt(i), 8);
		}
	}
};

module.exports = QR8bitByte;

};
__mods["QRBitBuffer"]=function(module,exports,__req){
function QRBitBuffer() {
	this.buffer = [];
	this.length = 0;
}

QRBitBuffer.prototype = {

	get : function(index) {
		var bufIndex = Math.floor(index / 8);
		return ( (this.buffer[bufIndex] >>> (7 - index % 8) ) & 1) == 1;
	},
	
	put : function(num, length) {
		for (var i = 0; i < length; i++) {
			this.putBit( ( (num >>> (length - i - 1) ) & 1) == 1);
		}
	},
	
	getLengthInBits : function() {
		return this.length;
	},
	
	putBit : function(bit) {
	
		var bufIndex = Math.floor(this.length / 8);
		if (this.buffer.length <= bufIndex) {
			this.buffer.push(0);
		}
	
		if (bit) {
			this.buffer[bufIndex] |= (0x80 >>> (this.length % 8) );
		}
	
		this.length++;
	}
};

module.exports = QRBitBuffer;

};
__mods["QRErrorCorrectLevel"]=function(module,exports,__req){
module.exports = {
	L : 1,
	M : 0,
	Q : 3,
	H : 2
};


};
__mods["QRMaskPattern"]=function(module,exports,__req){
module.exports = {
	PATTERN000 : 0,
	PATTERN001 : 1,
	PATTERN010 : 2,
	PATTERN011 : 3,
	PATTERN100 : 4,
	PATTERN101 : 5,
	PATTERN110 : 6,
	PATTERN111 : 7
};

};
__mods["QRMath"]=function(module,exports,__req){
var QRMath = {

	glog : function(n) {
	
		if (n < 1) {
			throw new Error("glog(" + n + ")");
		}
		
		return QRMath.LOG_TABLE[n];
	},
	
	gexp : function(n) {
	
		while (n < 0) {
			n += 255;
		}
	
		while (n >= 256) {
			n -= 255;
		}
	
		return QRMath.EXP_TABLE[n];
	},
	
	EXP_TABLE : new Array(256),
	
	LOG_TABLE : new Array(256)

};
	
for (var i = 0; i < 8; i++) {
	QRMath.EXP_TABLE[i] = 1 << i;
}
for (var i = 8; i < 256; i++) {
	QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4]
		^ QRMath.EXP_TABLE[i - 5]
		^ QRMath.EXP_TABLE[i - 6]
		^ QRMath.EXP_TABLE[i - 8];
}
for (var i = 0; i < 255; i++) {
	QRMath.LOG_TABLE[QRMath.EXP_TABLE[i] ] = i;
}

module.exports = QRMath;

};
__mods["QRMode"]=function(module,exports,__req){
module.exports = {
    MODE_NUMBER :       1 << 0,
    MODE_ALPHA_NUM :    1 << 1,
    MODE_8BIT_BYTE :    1 << 2,
    MODE_KANJI :        1 << 3
};

};
__mods["QRPolynomial"]=function(module,exports,__req){
var QRMath = __req("QRMath");

function QRPolynomial(num, shift) {
	if (num.length === undefined) {
		throw new Error(num.length + "/" + shift);
	}

	var offset = 0;

	while (offset < num.length && num[offset] === 0) {
		offset++;
	}

	this.num = new Array(num.length - offset + shift);
	for (var i = 0; i < num.length - offset; i++) {
		this.num[i] = num[i + offset];
	}
}

QRPolynomial.prototype = {

	get : function(index) {
		return this.num[index];
	},
	
	getLength : function() {
		return this.num.length;
	},
	
	multiply : function(e) {
	
		var num = new Array(this.getLength() + e.getLength() - 1);
	
		for (var i = 0; i < this.getLength(); i++) {
			for (var j = 0; j < e.getLength(); j++) {
				num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i) ) + QRMath.glog(e.get(j) ) );
			}
		}
	
		return new QRPolynomial(num, 0);
	},
	
	mod : function(e) {
	
		if (this.getLength() - e.getLength() < 0) {
			return this;
		}
	
		var ratio = QRMath.glog(this.get(0) ) - QRMath.glog(e.get(0) );
	
		var num = new Array(this.getLength() );
		
		for (var i = 0; i < this.getLength(); i++) {
			num[i] = this.get(i);
		}
		
		for (var x = 0; x < e.getLength(); x++) {
			num[x] ^= QRMath.gexp(QRMath.glog(e.get(x) ) + ratio);
		}
	
		// recursive call
		return new QRPolynomial(num, 0).mod(e);
	}
};

module.exports = QRPolynomial;

};
__mods["QRRSBlock"]=function(module,exports,__req){
var QRErrorCorrectLevel = __req("QRErrorCorrectLevel");

function QRRSBlock(totalCount, dataCount) {
	this.totalCount = totalCount;
	this.dataCount  = dataCount;
}

QRRSBlock.RS_BLOCK_TABLE = [

	// L
	// M
	// Q
	// H

	// 1
	[1, 26, 19],
	[1, 26, 16],
	[1, 26, 13],
	[1, 26, 9],
	
	// 2
	[1, 44, 34],
	[1, 44, 28],
	[1, 44, 22],
	[1, 44, 16],

	// 3
	[1, 70, 55],
	[1, 70, 44],
	[2, 35, 17],
	[2, 35, 13],

	// 4		
	[1, 100, 80],
	[2, 50, 32],
	[2, 50, 24],
	[4, 25, 9],
	
	// 5
	[1, 134, 108],
	[2, 67, 43],
	[2, 33, 15, 2, 34, 16],
	[2, 33, 11, 2, 34, 12],
	
	// 6
	[2, 86, 68],
	[4, 43, 27],
	[4, 43, 19],
	[4, 43, 15],
	
	// 7		
	[2, 98, 78],
	[4, 49, 31],
	[2, 32, 14, 4, 33, 15],
	[4, 39, 13, 1, 40, 14],
	
	// 8
	[2, 121, 97],
	[2, 60, 38, 2, 61, 39],
	[4, 40, 18, 2, 41, 19],
	[4, 40, 14, 2, 41, 15],
	
	// 9
	[2, 146, 116],
	[3, 58, 36, 2, 59, 37],
	[4, 36, 16, 4, 37, 17],
	[4, 36, 12, 4, 37, 13],
	
	// 10		
	[2, 86, 68, 2, 87, 69],
	[4, 69, 43, 1, 70, 44],
	[6, 43, 19, 2, 44, 20],
	[6, 43, 15, 2, 44, 16],

	// 11
	[4, 101, 81],
	[1, 80, 50, 4, 81, 51],
	[4, 50, 22, 4, 51, 23],
	[3, 36, 12, 8, 37, 13],

	// 12
	[2, 116, 92, 2, 117, 93],
	[6, 58, 36, 2, 59, 37],
	[4, 46, 20, 6, 47, 21],
	[7, 42, 14, 4, 43, 15],

	// 13
	[4, 133, 107],
	[8, 59, 37, 1, 60, 38],
	[8, 44, 20, 4, 45, 21],
	[12, 33, 11, 4, 34, 12],

	// 14
	[3, 145, 115, 1, 146, 116],
	[4, 64, 40, 5, 65, 41],
	[11, 36, 16, 5, 37, 17],
	[11, 36, 12, 5, 37, 13],

	// 15
	[5, 109, 87, 1, 110, 88],
	[5, 65, 41, 5, 66, 42],
	[5, 54, 24, 7, 55, 25],
	[11, 36, 12],

	// 16
	[5, 122, 98, 1, 123, 99],
	[7, 73, 45, 3, 74, 46],
	[15, 43, 19, 2, 44, 20],
	[3, 45, 15, 13, 46, 16],

	// 17
	[1, 135, 107, 5, 136, 108],
	[10, 74, 46, 1, 75, 47],
	[1, 50, 22, 15, 51, 23],
	[2, 42, 14, 17, 43, 15],

	// 18
	[5, 150, 120, 1, 151, 121],
	[9, 69, 43, 4, 70, 44],
	[17, 50, 22, 1, 51, 23],
	[2, 42, 14, 19, 43, 15],

	// 19
	[3, 141, 113, 4, 142, 114],
	[3, 70, 44, 11, 71, 45],
	[17, 47, 21, 4, 48, 22],
	[9, 39, 13, 16, 40, 14],

	// 20
	[3, 135, 107, 5, 136, 108],
	[3, 67, 41, 13, 68, 42],
	[15, 54, 24, 5, 55, 25],
	[15, 43, 15, 10, 44, 16],

	// 21
	[4, 144, 116, 4, 145, 117],
	[17, 68, 42],
	[17, 50, 22, 6, 51, 23],
	[19, 46, 16, 6, 47, 17],

	// 22
	[2, 139, 111, 7, 140, 112],
	[17, 74, 46],
	[7, 54, 24, 16, 55, 25],
	[34, 37, 13],

	// 23
	[4, 151, 121, 5, 152, 122],
	[4, 75, 47, 14, 76, 48],
	[11, 54, 24, 14, 55, 25],
	[16, 45, 15, 14, 46, 16],

	// 24
	[6, 147, 117, 4, 148, 118],
	[6, 73, 45, 14, 74, 46],
	[11, 54, 24, 16, 55, 25],
	[30, 46, 16, 2, 47, 17],

	// 25
	[8, 132, 106, 4, 133, 107],
	[8, 75, 47, 13, 76, 48],
	[7, 54, 24, 22, 55, 25],
	[22, 45, 15, 13, 46, 16],

	// 26
	[10, 142, 114, 2, 143, 115],
	[19, 74, 46, 4, 75, 47],
	[28, 50, 22, 6, 51, 23],
	[33, 46, 16, 4, 47, 17],

	// 27
	[8, 152, 122, 4, 153, 123],
	[22, 73, 45, 3, 74, 46],
	[8, 53, 23, 26, 54, 24],
	[12, 45, 15, 28, 46, 16],

	// 28
	[3, 147, 117, 10, 148, 118],
	[3, 73, 45, 23, 74, 46],
	[4, 54, 24, 31, 55, 25],
	[11, 45, 15, 31, 46, 16],

	// 29
	[7, 146, 116, 7, 147, 117],
	[21, 73, 45, 7, 74, 46],
	[1, 53, 23, 37, 54, 24],
	[19, 45, 15, 26, 46, 16],

	// 30
	[5, 145, 115, 10, 146, 116],
	[19, 75, 47, 10, 76, 48],
	[15, 54, 24, 25, 55, 25],
	[23, 45, 15, 25, 46, 16],

	// 31
	[13, 145, 115, 3, 146, 116],
	[2, 74, 46, 29, 75, 47],
	[42, 54, 24, 1, 55, 25],
	[23, 45, 15, 28, 46, 16],

	// 32
	[17, 145, 115],
	[10, 74, 46, 23, 75, 47],
	[10, 54, 24, 35, 55, 25],
	[19, 45, 15, 35, 46, 16],

	// 33
	[17, 145, 115, 1, 146, 116],
	[14, 74, 46, 21, 75, 47],
	[29, 54, 24, 19, 55, 25],
	[11, 45, 15, 46, 46, 16],

	// 34
	[13, 145, 115, 6, 146, 116],
	[14, 74, 46, 23, 75, 47],
	[44, 54, 24, 7, 55, 25],
	[59, 46, 16, 1, 47, 17],

	// 35
	[12, 151, 121, 7, 152, 122],
	[12, 75, 47, 26, 76, 48],
	[39, 54, 24, 14, 55, 25],
	[22, 45, 15, 41, 46, 16],

	// 36
	[6, 151, 121, 14, 152, 122],
	[6, 75, 47, 34, 76, 48],
	[46, 54, 24, 10, 55, 25],
	[2, 45, 15, 64, 46, 16],

	// 37
	[17, 152, 122, 4, 153, 123],
	[29, 74, 46, 14, 75, 47],
	[49, 54, 24, 10, 55, 25],
	[24, 45, 15, 46, 46, 16],

	// 38
	[4, 152, 122, 18, 153, 123],
	[13, 74, 46, 32, 75, 47],
	[48, 54, 24, 14, 55, 25],
	[42, 45, 15, 32, 46, 16],

	// 39
	[20, 147, 117, 4, 148, 118],
	[40, 75, 47, 7, 76, 48],
	[43, 54, 24, 22, 55, 25],
	[10, 45, 15, 67, 46, 16],

	// 40
	[19, 148, 118, 6, 149, 119],
	[18, 75, 47, 31, 76, 48],
	[34, 54, 24, 34, 55, 25],
	[20, 45, 15, 61, 46, 16]
];

QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
	
	var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
	
	if (rsBlock === undefined) {
		throw new Error("bad rs block @ typeNumber:" + typeNumber + "/errorCorrectLevel:" + errorCorrectLevel);
	}

	var length = rsBlock.length / 3;
	
	var list = [];
	
	for (var i = 0; i < length; i++) {

		var count = rsBlock[i * 3 + 0];
		var totalCount = rsBlock[i * 3 + 1];
		var dataCount  = rsBlock[i * 3 + 2];

		for (var j = 0; j < count; j++) {
			list.push(new QRRSBlock(totalCount, dataCount) );	
		}
	}
	
	return list;
};

QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {

	switch(errorCorrectLevel) {
	case QRErrorCorrectLevel.L :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
	case QRErrorCorrectLevel.M :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
	case QRErrorCorrectLevel.Q :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
	case QRErrorCorrectLevel.H :
		return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
	default :
		return undefined;
	}
};

module.exports = QRRSBlock;

};
__mods["QRUtil"]=function(module,exports,__req){
var QRMode = __req("QRMode");
var QRPolynomial = __req("QRPolynomial");
var QRMath = __req("QRMath");
var QRMaskPattern = __req("QRMaskPattern");

var QRUtil = {

    PATTERN_POSITION_TABLE : [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50],
        [6, 30, 54],        
        [6, 32, 58],
        [6, 34, 62],
        [6, 26, 46, 66],
        [6, 26, 48, 70],
        [6, 26, 50, 74],
        [6, 30, 54, 78],
        [6, 30, 56, 82],
        [6, 30, 58, 86],
        [6, 34, 62, 90],
        [6, 28, 50, 72, 94],
        [6, 26, 50, 74, 98],
        [6, 30, 54, 78, 102],
        [6, 28, 54, 80, 106],
        [6, 32, 58, 84, 110],
        [6, 30, 58, 86, 114],
        [6, 34, 62, 90, 118],
        [6, 26, 50, 74, 98, 122],
        [6, 30, 54, 78, 102, 126],
        [6, 26, 52, 78, 104, 130],
        [6, 30, 56, 82, 108, 134],
        [6, 34, 60, 86, 112, 138],
        [6, 30, 58, 86, 114, 142],
        [6, 34, 62, 90, 118, 146],
        [6, 30, 54, 78, 102, 126, 150],
        [6, 24, 50, 76, 102, 128, 154],
        [6, 28, 54, 80, 106, 132, 158],
        [6, 32, 58, 84, 110, 136, 162],
        [6, 26, 54, 82, 110, 138, 166],
        [6, 30, 58, 86, 114, 142, 170]
    ],

    G15 : (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0),
    G18 : (1 << 12) | (1 << 11) | (1 << 10) | (1 << 9) | (1 << 8) | (1 << 5) | (1 << 2) | (1 << 0),
    G15_MASK : (1 << 14) | (1 << 12) | (1 << 10)    | (1 << 4) | (1 << 1),

    getBCHTypeInfo : function(data) {
        var d = data << 10;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) >= 0) {
            d ^= (QRUtil.G15 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G15) ) );    
        }
        return ( (data << 10) | d) ^ QRUtil.G15_MASK;
    },

    getBCHTypeNumber : function(data) {
        var d = data << 12;
        while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) >= 0) {
            d ^= (QRUtil.G18 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(QRUtil.G18) ) );    
        }
        return (data << 12) | d;
    },

    getBCHDigit : function(data) {

        var digit = 0;

        while (data !== 0) {
            digit++;
            data >>>= 1;
        }

        return digit;
    },

    getPatternPosition : function(typeNumber) {
        return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1];
    },

    getMask : function(maskPattern, i, j) {
        
        switch (maskPattern) {
            
        case QRMaskPattern.PATTERN000 : return (i + j) % 2 === 0;
        case QRMaskPattern.PATTERN001 : return i % 2 === 0;
        case QRMaskPattern.PATTERN010 : return j % 3 === 0;
        case QRMaskPattern.PATTERN011 : return (i + j) % 3 === 0;
        case QRMaskPattern.PATTERN100 : return (Math.floor(i / 2) + Math.floor(j / 3) ) % 2 === 0;
        case QRMaskPattern.PATTERN101 : return (i * j) % 2 + (i * j) % 3 === 0;
        case QRMaskPattern.PATTERN110 : return ( (i * j) % 2 + (i * j) % 3) % 2 === 0;
        case QRMaskPattern.PATTERN111 : return ( (i * j) % 3 + (i + j) % 2) % 2 === 0;

        default :
            throw new Error("bad maskPattern:" + maskPattern);
        }
    },

    getErrorCorrectPolynomial : function(errorCorrectLength) {

        var a = new QRPolynomial([1], 0);

        for (var i = 0; i < errorCorrectLength; i++) {
            a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0) );
        }

        return a;
    },

    getLengthInBits : function(mode, type) {

        if (1 <= type && type < 10) {

            // 1 - 9

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 10;
            case QRMode.MODE_ALPHA_NUM  : return 9;
            case QRMode.MODE_8BIT_BYTE  : return 8;
            case QRMode.MODE_KANJI      : return 8;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 27) {

            // 10 - 26

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 12;
            case QRMode.MODE_ALPHA_NUM  : return 11;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 10;
            default :
                throw new Error("mode:" + mode);
            }

        } else if (type < 41) {

            // 27 - 40

            switch(mode) {
            case QRMode.MODE_NUMBER     : return 14;
            case QRMode.MODE_ALPHA_NUM  : return 13;
            case QRMode.MODE_8BIT_BYTE  : return 16;
            case QRMode.MODE_KANJI      : return 12;
            default :
                throw new Error("mode:" + mode);
            }

        } else {
            throw new Error("type:" + type);
        }
    },

    getLostPoint : function(qrCode) {
        
        var moduleCount = qrCode.getModuleCount();
        var lostPoint = 0;
        var row = 0; 
        var col = 0;

        
        // LEVEL1
        
        for (row = 0; row < moduleCount; row++) {

            for (col = 0; col < moduleCount; col++) {

                var sameCount = 0;
                var dark = qrCode.isDark(row, col);

                for (var r = -1; r <= 1; r++) {

                    if (row + r < 0 || moduleCount <= row + r) {
                        continue;
                    }

                    for (var c = -1; c <= 1; c++) {

                        if (col + c < 0 || moduleCount <= col + c) {
                            continue;
                        }

                        if (r === 0 && c === 0) {
                            continue;
                        }

                        if (dark === qrCode.isDark(row + r, col + c) ) {
                            sameCount++;
                        }
                    }
                }

                if (sameCount > 5) {
                    lostPoint += (3 + sameCount - 5);
                }
            }
        }

        // LEVEL2

        for (row = 0; row < moduleCount - 1; row++) {
            for (col = 0; col < moduleCount - 1; col++) {
                var count = 0;
                if (qrCode.isDark(row,     col    ) ) count++;
                if (qrCode.isDark(row + 1, col    ) ) count++;
                if (qrCode.isDark(row,     col + 1) ) count++;
                if (qrCode.isDark(row + 1, col + 1) ) count++;
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }

        // LEVEL3

        for (row = 0; row < moduleCount; row++) {
            for (col = 0; col < moduleCount - 6; col++) {
                if (qrCode.isDark(row, col) && 
                        !qrCode.isDark(row, col + 1) && 
                         qrCode.isDark(row, col + 2) && 
                         qrCode.isDark(row, col + 3) && 
                         qrCode.isDark(row, col + 4) && 
                        !qrCode.isDark(row, col + 5) && 
                         qrCode.isDark(row, col + 6) ) {
                    lostPoint += 40;
                }
            }
        }

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount - 6; row++) {
                if (qrCode.isDark(row, col) &&
                        !qrCode.isDark(row + 1, col) &&
                         qrCode.isDark(row + 2, col) &&
                         qrCode.isDark(row + 3, col) &&
                         qrCode.isDark(row + 4, col) &&
                        !qrCode.isDark(row + 5, col) &&
                         qrCode.isDark(row + 6, col) ) {
                    lostPoint += 40;
                }
            }
        }

        // LEVEL4
        
        var darkCount = 0;

        for (col = 0; col < moduleCount; col++) {
            for (row = 0; row < moduleCount; row++) {
                if (qrCode.isDark(row, col) ) {
                    darkCount++;
                }
            }
        }
        
        var ratio = Math.abs(100 * darkCount / moduleCount / moduleCount - 50) / 5;
        lostPoint += ratio * 10;

        return lostPoint;       
    }

};

module.exports = QRUtil;

};
__mods["index"]=function(module,exports,__req){
//---------------------------------------------------------------------
// QRCode for JavaScript
//
// Copyright (c) 2009 Kazuhiko Arase
//
// URL: http://www.d-project.com/
//
// Licensed under the MIT license:
//   http://www.opensource.org/licenses/mit-license.php
//
// The word "QR Code" is registered trademark of 
// DENSO WAVE INCORPORATED
//   http://www.denso-wave.com/qrcode/faqpatent-e.html
//
//---------------------------------------------------------------------
// Modified to work in node for this project (and some refactoring)
//---------------------------------------------------------------------

var QR8bitByte = __req("QR8bitByte");
var QRUtil = __req("QRUtil");
var QRPolynomial = __req("QRPolynomial");
var QRRSBlock = __req("QRRSBlock");
var QRBitBuffer = __req("QRBitBuffer");

function QRCode(typeNumber, errorCorrectLevel) {
	this.typeNumber = typeNumber;
	this.errorCorrectLevel = errorCorrectLevel;
	this.modules = null;
	this.moduleCount = 0;
	this.dataCache = null;
	this.dataList = [];
}

QRCode.prototype = {
	
	addData : function(data) {
		var newData = new QR8bitByte(data);
		this.dataList.push(newData);
		this.dataCache = null;
	},
	
	isDark : function(row, col) {
		if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
			throw new Error(row + "," + col);
		}
		return this.modules[row][col];
	},

	getModuleCount : function() {
		return this.moduleCount;
	},
	
	make : function() {
		// Calculate automatically typeNumber if provided is < 1
		if (this.typeNumber < 1 ){
			var typeNumber = 1;
			for (typeNumber = 1; typeNumber < 40; typeNumber++) {
				var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, this.errorCorrectLevel);

				var buffer = new QRBitBuffer();
				var totalDataCount = 0;
				for (var i = 0; i < rsBlocks.length; i++) {
					totalDataCount += rsBlocks[i].dataCount;
				}

				for (var x = 0; x < this.dataList.length; x++) {
					var data = this.dataList[x];
					buffer.put(data.mode, 4);
					buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
					data.write(buffer);
				}
				if (buffer.getLengthInBits() <= totalDataCount * 8)
					break;
			}
			this.typeNumber = typeNumber;
		}
		this.makeImpl(false, this.getBestMaskPattern() );
	},
	
	makeImpl : function(test, maskPattern) {
		
		this.moduleCount = this.typeNumber * 4 + 17;
		this.modules = new Array(this.moduleCount);
		
		for (var row = 0; row < this.moduleCount; row++) {
			
			this.modules[row] = new Array(this.moduleCount);
			
			for (var col = 0; col < this.moduleCount; col++) {
				this.modules[row][col] = null;//(col + row) % 3;
			}
		}
	
		this.setupPositionProbePattern(0, 0);
		this.setupPositionProbePattern(this.moduleCount - 7, 0);
		this.setupPositionProbePattern(0, this.moduleCount - 7);
		this.setupPositionAdjustPattern();
		this.setupTimingPattern();
		this.setupTypeInfo(test, maskPattern);
		
		if (this.typeNumber >= 7) {
			this.setupTypeNumber(test);
		}
	
		if (this.dataCache === null) {
			this.dataCache = QRCode.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
		}
	
		this.mapData(this.dataCache, maskPattern);
	},

	setupPositionProbePattern : function(row, col)  {
		
		for (var r = -1; r <= 7; r++) {
			
			if (row + r <= -1 || this.moduleCount <= row + r) continue;
			
			for (var c = -1; c <= 7; c++) {
				
				if (col + c <= -1 || this.moduleCount <= col + c) continue;
				
				if ( (0 <= r && r <= 6 && (c === 0 || c === 6) ) || 
                     (0 <= c && c <= 6 && (r === 0 || r === 6) ) || 
                     (2 <= r && r <= 4 && 2 <= c && c <= 4) ) {
					this.modules[row + r][col + c] = true;
				} else {
					this.modules[row + r][col + c] = false;
				}
			}		
		}		
	},
	
	getBestMaskPattern : function() {
	
		var minLostPoint = 0;
		var pattern = 0;
	
		for (var i = 0; i < 8; i++) {
			
			this.makeImpl(true, i);
	
			var lostPoint = QRUtil.getLostPoint(this);
	
			if (i === 0 || minLostPoint >  lostPoint) {
				minLostPoint = lostPoint;
				pattern = i;
			}
		}
	
		return pattern;
	},
	
	createMovieClip : function(target_mc, instance_name, depth) {
	
		var qr_mc = target_mc.createEmptyMovieClip(instance_name, depth);
		var cs = 1;
	
		this.make();

		for (var row = 0; row < this.modules.length; row++) {
			
			var y = row * cs;
			
			for (var col = 0; col < this.modules[row].length; col++) {
	
				var x = col * cs;
				var dark = this.modules[row][col];
			
				if (dark) {
					qr_mc.beginFill(0, 100);
					qr_mc.moveTo(x, y);
					qr_mc.lineTo(x + cs, y);
					qr_mc.lineTo(x + cs, y + cs);
					qr_mc.lineTo(x, y + cs);
					qr_mc.endFill();
				}
			}
		}
		
		return qr_mc;
	},

	setupTimingPattern : function() {
		
		for (var r = 8; r < this.moduleCount - 8; r++) {
			if (this.modules[r][6] !== null) {
				continue;
			}
			this.modules[r][6] = (r % 2 === 0);
		}
	
		for (var c = 8; c < this.moduleCount - 8; c++) {
			if (this.modules[6][c] !== null) {
				continue;
			}
			this.modules[6][c] = (c % 2 === 0);
		}
	},
	
	setupPositionAdjustPattern : function() {
	
		var pos = QRUtil.getPatternPosition(this.typeNumber);
		
		for (var i = 0; i < pos.length; i++) {
		
			for (var j = 0; j < pos.length; j++) {
			
				var row = pos[i];
				var col = pos[j];
				
				if (this.modules[row][col] !== null) {
					continue;
				}
				
				for (var r = -2; r <= 2; r++) {
				
					for (var c = -2; c <= 2; c++) {
					
						if (Math.abs(r) === 2 || 
                            Math.abs(c) === 2 ||
                            (r === 0 && c === 0) ) {
							this.modules[row + r][col + c] = true;
						} else {
							this.modules[row + r][col + c] = false;
						}
					}
				}
			}
		}
	},
	
	setupTypeNumber : function(test) {
	
		var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
        var mod;
	
		for (var i = 0; i < 18; i++) {
			mod = (!test && ( (bits >> i) & 1) === 1);
			this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
		}
	
		for (var x = 0; x < 18; x++) {
			mod = (!test && ( (bits >> x) & 1) === 1);
			this.modules[x % 3 + this.moduleCount - 8 - 3][Math.floor(x / 3)] = mod;
		}
	},
	
	setupTypeInfo : function(test, maskPattern) {
	
		var data = (this.errorCorrectLevel << 3) | maskPattern;
		var bits = QRUtil.getBCHTypeInfo(data);
        var mod;
	
		// vertical		
		for (var v = 0; v < 15; v++) {
	
			mod = (!test && ( (bits >> v) & 1) === 1);
	
			if (v < 6) {
				this.modules[v][8] = mod;
			} else if (v < 8) {
				this.modules[v + 1][8] = mod;
			} else {
				this.modules[this.moduleCount - 15 + v][8] = mod;
			}
		}
	
		// horizontal
		for (var h = 0; h < 15; h++) {
	
			mod = (!test && ( (bits >> h) & 1) === 1);
			
			if (h < 8) {
				this.modules[8][this.moduleCount - h - 1] = mod;
			} else if (h < 9) {
				this.modules[8][15 - h - 1 + 1] = mod;
			} else {
				this.modules[8][15 - h - 1] = mod;
			}
		}
	
		// fixed module
		this.modules[this.moduleCount - 8][8] = (!test);
	
	},
	
	mapData : function(data, maskPattern) {
		
		var inc = -1;
		var row = this.moduleCount - 1;
		var bitIndex = 7;
		var byteIndex = 0;
		
		for (var col = this.moduleCount - 1; col > 0; col -= 2) {
	
			if (col === 6) col--;
	
			while (true) {
	
				for (var c = 0; c < 2; c++) {
					
					if (this.modules[row][col - c] === null) {
						
						var dark = false;
	
						if (byteIndex < data.length) {
							dark = ( ( (data[byteIndex] >>> bitIndex) & 1) === 1);
						}
	
						var mask = QRUtil.getMask(maskPattern, row, col - c);
	
						if (mask) {
							dark = !dark;
						}
						
						this.modules[row][col - c] = dark;
						bitIndex--;
	
						if (bitIndex === -1) {
							byteIndex++;
							bitIndex = 7;
						}
					}
				}
								
				row += inc;
	
				if (row < 0 || this.moduleCount <= row) {
					row -= inc;
					inc = -inc;
					break;
				}
			}
		}
		
	}

};

QRCode.PAD0 = 0xEC;
QRCode.PAD1 = 0x11;

QRCode.createData = function(typeNumber, errorCorrectLevel, dataList) {
	
	var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
	
	var buffer = new QRBitBuffer();
	
	for (var i = 0; i < dataList.length; i++) {
		var data = dataList[i];
		buffer.put(data.mode, 4);
		buffer.put(data.getLength(), QRUtil.getLengthInBits(data.mode, typeNumber) );
		data.write(buffer);
	}

	// calc num max data.
	var totalDataCount = 0;
	for (var x = 0; x < rsBlocks.length; x++) {
		totalDataCount += rsBlocks[x].dataCount;
	}

	if (buffer.getLengthInBits() > totalDataCount * 8) {
		throw new Error("code length overflow. (" + 
            buffer.getLengthInBits() + 
            ">" +  
            totalDataCount * 8 + 
            ")");
	}

	// end code
	if (buffer.getLengthInBits() + 4 <= totalDataCount * 8) {
		buffer.put(0, 4);
	}

	// padding
	while (buffer.getLengthInBits() % 8 !== 0) {
		buffer.putBit(false);
	}

	// padding
	while (true) {
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD0, 8);
		
		if (buffer.getLengthInBits() >= totalDataCount * 8) {
			break;
		}
		buffer.put(QRCode.PAD1, 8);
	}

	return QRCode.createBytes(buffer, rsBlocks);
};

QRCode.createBytes = function(buffer, rsBlocks) {

	var offset = 0;
	
	var maxDcCount = 0;
	var maxEcCount = 0;
	
	var dcdata = new Array(rsBlocks.length);
	var ecdata = new Array(rsBlocks.length);
	
	for (var r = 0; r < rsBlocks.length; r++) {

		var dcCount = rsBlocks[r].dataCount;
		var ecCount = rsBlocks[r].totalCount - dcCount;

		maxDcCount = Math.max(maxDcCount, dcCount);
		maxEcCount = Math.max(maxEcCount, ecCount);
		
		dcdata[r] = new Array(dcCount);
		
		for (var i = 0; i < dcdata[r].length; i++) {
			dcdata[r][i] = 0xff & buffer.buffer[i + offset];
		}
		offset += dcCount;
		
		var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
		var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);

		var modPoly = rawPoly.mod(rsPoly);
		ecdata[r] = new Array(rsPoly.getLength() - 1);
		for (var x = 0; x < ecdata[r].length; x++) {
            var modIndex = x + modPoly.getLength() - ecdata[r].length;
			ecdata[r][x] = (modIndex >= 0)? modPoly.get(modIndex) : 0;
		}

	}
	
	var totalCodeCount = 0;
	for (var y = 0; y < rsBlocks.length; y++) {
		totalCodeCount += rsBlocks[y].totalCount;
	}

	var data = new Array(totalCodeCount);
	var index = 0;

	for (var z = 0; z < maxDcCount; z++) {
		for (var s = 0; s < rsBlocks.length; s++) {
			if (z < dcdata[s].length) {
				data[index++] = dcdata[s][z];
			}
		}
	}

	for (var xx = 0; xx < maxEcCount; xx++) {
		for (var t = 0; t < rsBlocks.length; t++) {
			if (xx < ecdata[t].length) {
				data[index++] = ecdata[t][xx];
			}
		}
	}

	return data;

};

module.exports = QRCode;

};
function __req(id){if(__cache[id])return __cache[id].exports;const fn=__mods[id];if(!fn)throw new Error("QR module not found: "+id);const module={exports:{}};__cache[id]=module;fn(module,module.exports,__req);return module.exports;}
const QRCode=__req("index"), Levels=__req("QRErrorCorrectLevel");
function escapeXml(v){return String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"}[ch]||ch));}
function toSvg(text,opts){opts=opts||{};const qr=new QRCode(-1,Levels.M);qr.addData(String(text||""));qr.make();const count=qr.getModuleCount(),margin=Math.max(2,Number(opts.margin)||4),size=count+margin*2;let path="";for(let r=0;r<count;r++){let start=-1;for(let c=0;c<=count;c++){const dark=c<count&&qr.isDark(r,c);if(dark&&start<0)start=c;if((!dark||c===count)&&start>=0){path+=`M${start+margin} ${r+margin}h${c-start}v1H${start+margin}z`;start=-1;}}}return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#0f2f66"/></svg>`;}
global.WVQRCode={toSvg};
})(window);

"use strict";

const cfg = window.APP_CONFIG;
const FRONTEND_BUILD="2026.08.18-round183-plan-actual-kpi-backfill";
const CLIENT_HEALTH_KEY="wvf_client_health_v1";
function readClientIssues(){try{const rows=JSON.parse(localStorage.getItem(CLIENT_HEALTH_KEY)||"[]");return Array.isArray(rows)?rows:[]}catch{return[]}}
function recordClientIssue(type,message,source=""){try{const now=Date.now(),cleanMessage=String(message||"ไม่ทราบสาเหตุ").slice(0,240),cleanSource=String(source||"").split("?")[0].slice(0,160),rows=readClientIssues().filter(item=>now-Number(item.at||0)<7*86400000);const last=rows[0];if(last&&last.type===type&&last.message===cleanMessage&&last.source===cleanSource&&now-Number(last.at||0)<60000)return;rows.unshift({at:now,type:String(type||"ERROR").slice(0,40),message:cleanMessage,source:cleanSource});localStorage.setItem(CLIENT_HEALTH_KEY,JSON.stringify(rows.slice(0,20)))}catch{}}
function clientHealthSnapshot(){const issues=readClientIssues().filter(item=>Date.now()-Number(item.at||0)<86400000);return{frontendBuild:FRONTEND_BUILD,online:navigator.onLine,serviceWorkerSupported:"serviceWorker" in navigator,serviceWorkerControlled:Boolean(navigator.serviceWorker?.controller),issues24h:issues.length,latestIssue:issues[0]||null}}
window.addEventListener("error",event=>recordClientIssue("JS_ERROR",event.message||event.error?.message,event.filename||"browser"));
window.addEventListener("unhandledrejection",event=>recordClientIssue("PROMISE",event.reason?.message||event.reason||"Unhandled promise","browser"));
const state = { token: sessionStorage.getItem("wvf_token") || "", user: null, view: "operations", vehicles: [], activeDoors: [], trackingEnabled: true, documentCheckEnabled: false, display:{dashboardEnabled:true,datatableEnabled:true}, appointment:{moduleEnabled:false,uploadEnabled:false}, appointmentLive:null, queueRecall: {enabled:true,cooldownSeconds:10,maxCalls:0,requireReason:true,allowDoorChange:true,requireNewDoorOnChange:true,enabledReasons:["NO_SHOW","DRIVER_NOT_FOUND","WRONG_DOOR","DOOR_CHANGE","GENERAL","OTHER"]}, online: navigator.onLine };
const scannerState = { active:false, stream:null, detector:null, timer:0, reading:false, canvas:null, context:null, lastValue:"", lastSeenAt:0, repeatCount:0 };
const submitState = { busy:false };
const receivingState = { busyIds:new Set() };
const uiState = { detailsOpen:false };
const inboundLiveState = { version:"", checking:false, failures:0, nextAllowedAt:0 };
const inboundListState = { filter:"ALL" };
const inboundTrackPanel = { timer:0, until:0, active:false };
const operationsUiState = { filter:"", search:"" };
const adminState = { data:null, tab:(()=>{try{return localStorage.getItem("wvf_admin_tab")||"users"}catch{return"users"}})(), busy:false };
const adminHealthState={data:null,busy:false,error:""};
const adminPerformanceState={data:null,client:null,busy:false,error:""};
const adminResilienceState={data:null,client:null,busy:false,error:""};
const adminReadinessState={data:null,busy:false,error:""};
const adminDataTools={tab:"overview",inspector:null,busy:false,openTable:"",openCommand:"",openSchema:"",archiveMonth:"",archivePreview:null,archiveBusy:false,archiveHistory:null,archiveHistoryBusy:false,archiveStoreBusy:false,archiveVerify:null,archiveVerifyBusy:false,cleanupMonth:"",cleanupPreview:null,cleanupBusy:false,cleanupScript:null,cleanupVerify:null,cleanupExecuteBusy:false,cleanupHistory:null};
const doorEditorState = { items:[], search:"", group:"ALL", status:"ALL" };
const appointmentUploadState={config:null,result:null,preview:null,worker:null,busy:false};
const dashboardState = { range:"today", date:"", shiftId:"", shiftAutoDate:false, tab:"overview", data:null, dataIdentity:"", busy:false, reloadRequested:false, lastLoadedAt:0, error:"", cacheState:"", analyticsBusy:false, analyticsSeq:0, analyticsController:null, analyticsError:"", analyticsLastLoadedAt:0, calendarMonth:"", calendarMetric:"gateIn", calendarData:null, theme:localStorage.getItem("wvf_dashboard_theme")||"blue", requestSeq:0, requestController:null, slowTimer:0, retryTimer:0, failures:0, snapshotLoaded:false };
const DASHBOARD_THEME_OPTIONS=[
  {id:"blue",label:"น้ำเงิน"},
  {id:"slate",label:"เทา"},
  {id:"green",label:"เขียว"},
  {id:"indigo",label:"คราม"},
  {id:"dark",label:"เข้ม"},
  {id:"warm",label:"ครีม"}
];
function dashboardThemeMeta(theme){return DASHBOARD_THEME_OPTIONS.find(item=>item.id===theme)||DASHBOARD_THEME_OPTIONS[0]}
function normalizeDashboardTheme(theme){const allowed=DASHBOARD_THEME_OPTIONS.map(item=>item.id);return allowed.includes(theme)?theme:"blue"}
function dashboardThemeMenuHtml(){return `<b>สีหน้าจอ</b>${DASHBOARD_THEME_OPTIONS.map(item=>`<button type="button" data-dashboard-theme="${item.id}" class="${normalizeDashboardTheme(dashboardState.theme)===item.id?"active":""}"><i></i><span>${item.label}</span></button>`).join("")}`}
const datatableState={meta:null,data:null,busy:false,reloadRequested:false,requestSeq:0,detailBusy:false,refreshMetaRequested:false,activity:[],shiftAutoDate:false,stage:"overview",from:"",to:"",shiftId:"",search:"",sla:"ALL",status:"ALL",door:"",actor:"",sort:"start_desc",page:1,limit:25,problemOnly:false,rejectedOnly:false,invalidAppointmentOnly:false,searchTimer:0,immersive:false,nativeFullscreen:false,mobileFiltersOpen:false,viewportMode:"",viewportTimer:0,filterBack:[],filterForward:[],filterHistoryReady:false,filterApplyingHistory:false,columns:new Set(JSON.parse(localStorage.getItem("wvf_dt_columns_r100")||localStorage.getItem("wvf_dt_columns_r96")||localStorage.getItem("wvf_dt_columns_r95")||'["company","plate","shift","actor"]'))};
const DASHBOARD_INFO={
  dashboard:{title:"ข้อมูลใน Dashboard",meaning:"สรุปข้อมูลรถและขั้นตอนการทำงานตามวันที่ ช่วงเวลา และกะที่เลือก",source:"ข้อมูลรถมาจากระบบ Gate In/Gate Out แบบอ่านอย่างเดียว ส่วนขั้นตอน Inbound และตรวจรับมาจากประวัติการทำงานในระบบนี้",calculation:"ตัวเลขทุกจุดคำนวณจากข้อมูลใน D1 ณ เวลาที่ระบุว่าอัปเดตล่าสุด"},
  gateIn:{title:"รถเข้า",meaning:"จำนวนรถที่มีเวลา Gate In อยู่ในช่วงที่เลือก",source:"เวลา Gate In ของรถแต่ละคัน",calculation:"นับ Auto ID ที่ไม่ซ้ำกันตามเวลา Gate In"},
  gateOut:{title:"รถออก",meaning:"จำนวนรถที่มีเวลา Gate Out อยู่ในช่วงที่เลือก แม้รถจะเข้ามาจากช่วงก่อน",source:"เวลา Gate Out ของรถแต่ละคัน",calculation:"นับ Auto ID ที่ไม่ซ้ำกันตามเวลา Gate Out"},
  carryOut:{title:"คงอยู่",meaning:"รถที่เข้าพื้นที่แล้ว แต่ยังไม่มี Gate Out ณ ปลายช่วงข้อมูล",source:"เวลา Gate In และ Gate Out",calculation:"Gate In ก่อนปลายช่วง และ Gate Out ยังไม่มีหรือเกิดหลังปลายช่วง"},
  receivingCompleted:{title:"รับเสร็จ",meaning:"จำนวนครั้งที่พนักงานยืนยันตรวจรับสินค้าเสร็จในช่วงที่เลือก",source:"ประวัติยืนยันรับสินค้าเสร็จ",calculation:"นับเหตุการณ์รับสินค้าเสร็จที่เกิดในช่วงข้อมูล"},
  average:{title:"เวลาเฉลี่ย",meaning:"เวลาเฉลี่ยตั้งแต่ Gate In ถึง Gate Out ของรถที่ Gate In ในช่วงที่เลือกและปิดงานแล้ว",source:"เวลา Gate In และ Gate Out",calculation:"ผลรวมเวลาของรถที่ปิดงาน หารด้วยจำนวนรถที่ปิดงาน"},
  p90:{title:"P90",meaning:"เวลาที่รถ 90% ของกลุ่มใช้ไม่เกินค่านี้ เหมาะสำหรับดูรถส่วนใหญ่โดยลดผลจากค่าผิดปกติ",source:"เวลารวม Gate In ถึง Gate Out ของรถที่ปิดงานแล้ว",calculation:"เรียงเวลาจากน้อยไปมาก แล้วเลือกค่าที่ตำแหน่ง 90%"},
  flow:{title:"การไหลของงาน",meaning:"ตรวจสมดุลงานระหว่างต้นช่วง รถเข้า รถออก และงานปลายช่วง",source:"ข้อมูลรถ ณ ต้นช่วงและปลายช่วง",calculation:"ต้นช่วง + รถเข้า ควรเท่ากับ รถออก + ปลายช่วง เมื่อเลือกช่วงเดียว"},
  hourly:{title:"รถเข้าแต่ละชั่วโมง",meaning:"บอกช่วงเวลาที่รถเข้าหนาแน่น เพื่อจัดคนและประตู",source:"เวลา Gate In",calculation:"จัดกลุ่มรถเข้าตามชั่วโมงเวลาไทย ตัวเลขบนแท่งคือจำนวนคัน"},
  stageQueue:{title:"คิวปลายช่วง",meaning:"จำนวนรถที่ยังอยู่ในพื้นที่ แยกตามขั้นตอนล่าสุด ณ ปลายช่วง",source:"สถานะล่าสุดของรถและประวัติขั้นตอน",calculation:"รถหนึ่งคันอยู่ได้เพียงหนึ่งขั้นตอนในเวลานั้น"},
  aging:{title:"อายุงานค้างตามขั้นตอน",meaning:"แสดงว่างานค้างนานเท่าใด และติดอยู่ที่ขั้นตอนใด",source:"เวลา Gate In และสถานะรถ ณ ปลายช่วง",calculation:"อายุงานนับจาก Gate In ถึงปลายช่วง แล้วแบ่งเป็น 5 ช่วงเวลา สีแต่ละส่วนแทนขั้นตอน"},
  urgent:{title:"เร่งดำเนินการ",meaning:"รายการรถที่ควรติดตามก่อน เรียงจากระดับเตือนสูงและเวลาค้างนาน",source:"เงื่อนไขเตือนที่ Admin ตั้งและเวลาของแต่ละขั้นตอน",calculation:"ระดับเตือนสูงกว่ามาก่อน หากระดับเท่ากันเรียงตามเวลารวมมากกว่า"},
  comparison:{title:"เปรียบเทียบ",meaning:"เทียบจำนวนรถเข้า รถที่ปิดงาน และเวลาเฉลี่ยตามวันหรือกะ",source:"ข้อมูลย้อนหลังในช่วงที่เลือก",calculation:"แท่งสีน้ำเงินคือรถเข้า แท่งสีเขียวคือปิดงาน เส้นคือเวลาเฉลี่ย"},
  handover:{title:"กะและส่งต่อ",meaning:"แยกงานที่รับมาจากช่วงก่อน งานใหม่ งานที่ปิดได้ และงานส่งต่อ",source:"สถานะรถที่ต้นช่วงและปลายช่วง",calculation:"งานส่งต่อคือรถที่ยังอยู่ในพื้นที่ ณ ปลายช่วง ไม่ถือเป็นงานเสียหาย"},
  performance:{title:"ประสิทธิภาพ",meaning:"แสดงเวลาของแต่ละช่วงงาน การกระจายเวลาปิด และผลลัพธ์รายกะ",source:"เวลาของเหตุการณ์แต่ละขั้นตอน",calculation:"คำนวณเฉพาะคู่เวลาที่มีข้อมูลครบและลำดับเวลาถูกต้อง"},
  capacity:{title:"ประตู",meaning:"ดูภาระงานและความหนาแน่นตามรหัสประตูและเวลา",source:"ประตูที่ผู้ใช้เลือกและเวลา Gate In",calculation:"ไม่ใช้ชื่อบริษัทเป็นตัวอ้างอิง เพราะข้อมูลชื่อบริษัทอาจสะกดต่างกัน"},
  exceptions:{title:"ข้อยกเว้น",meaning:"รวมระดับเตือน คอขวด และข้อมูลที่ขาด เพื่อให้แก้ปัญหาได้ทันที",source:"เงื่อนไข Admin สถานะปัจจุบัน และข้อมูลรถ",calculation:"ตัวเลขเป็นภาพ ณ ปลายช่วงที่เลือก"}
};
const alertSoundState = { initialized:false, levels:new Map() };
let audioContext = null;
const $ = (id) => document.getElementById(id);

function sanitizeSensitiveUrl(){
  try{
    const url=new URL(window.location.href);
    let changed=false;
    ["name","password","username","pass"].forEach(key=>{if(url.searchParams.has(key)){url.searchParams.delete(key);changed=true}});
    if(changed)history.replaceState(null,"",`${url.pathname}${url.search}${url.hash}`);
  }catch{}
}
sanitizeSensitiveUrl();

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("online", () => { setConnection(true); checkInboundLiveUpdates(true); if(state.view==="dashboard"){dashboardState.failures=0;dashboardState.lastLoadedAt=0;void loadDashboard(!dashboardState.data,true)}else if(state.view==="operations"){void refreshLiveData()}else if(state.view==="datatable"){void refreshDatatableAll()}else if(state.view==="admin"&&adminState.tab==="health"){void renderAdminDiagnostics(true)} });
window.addEventListener("offline", () => setConnection(false));
window.addEventListener("focus",()=>checkInboundLiveUpdates(true));
window.addEventListener("resize",()=>{if(state.view!=="dashboard")return;closeDashboardMobileMenu();const popover=$("dashboardCalendarPopover");if(popover&&window.innerWidth>980)popover.hidden=true});
document.addEventListener("visibilitychange", () => { if (!document.hidden && scannerState.active) $("qrVideo")?.play().catch(() => undefined); if(!document.hidden){checkInboundLiveUpdates(true);if(state.view==="operations")void refreshLiveData();else if(state.view==="datatable")void refreshDatatableAll();else if(state.view==="dashboard"&&Date.now()-Number(dashboardState.lastLoadedAt||0)>15000)void loadDashboard(false,true)} });

async function init() {
  $("brandName").textContent = cfg.appName;
  $("loginForm").addEventListener("submit", login);
  $("logoutButton").addEventListener("click", logout);
  $("togglePassword").addEventListener("click", togglePassword);
  document.addEventListener("fullscreenchange",()=>{if(state.view==="datatable"&&!document.fullscreenElement&&datatableState.nativeFullscreen){datatableState.nativeFullscreen=false;datatableState.immersive=false}updateFullscreenButton();syncDashboardFullscreenShell();syncDatatableFullscreenShell()});
  setInterval(updateClocks, 1000); updateClocks(); setConnection(navigator.onLine);
  setInterval(refreshLiveData, Math.max(15, Number(cfg.refreshSeconds) || 30) * 1000);
  setInterval(()=>checkInboundLiveUpdates(false),5000);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js?v=20260818-r182",{updateViaCache:"none"}).catch(() => undefined);
  if (state.token) { try { const me = await api("/api/auth/me"); state.user = me.user; state.display=normalizeDisplaySettings(me.display); state.appointment=normalizeAppointmentAccess(me.appointment); openApp(); } catch { clearSession(); } }
}

async function login(event) {
  event.preventDefault();
  const button = event.submitter; button.disabled = true; button.textContent = "กำลังเข้าสู่ระบบ"; $("loginMessage").textContent = "";
  try {
    const result = await api("/api/auth/login", { method:"POST", auth:false, body:{ name:$("loginName").value.trim(), password:$("loginPassword").value } });
    state.token = result.token; state.user = result.user; state.display=normalizeDisplaySettings(result.display); state.appointment=normalizeAppointmentAccess(result.appointment); sessionStorage.setItem("wvf_token", state.token); openApp();
  } catch (error) { $("loginMessage").textContent = error.message; }
  finally { button.disabled = false; button.textContent = "เข้าสู่ระบบ"; }
}

function normalizeDisplaySettings(value){return{dashboardEnabled:value?.dashboardEnabled!==false&&value?.dashboardEnabled!==0,datatableEnabled:value?.datatableEnabled!==false&&value?.datatableEnabled!==0}}
function normalizeAppointmentAccess(value){return{moduleEnabled:value?.moduleEnabled===true||value?.moduleEnabled===1,uploadEnabled:value?.uploadEnabled===true||value?.uploadEnabled===1}}
function viewEnabled(view){if(view==="dashboard")return state.display?.dashboardEnabled!==false;if(view==="datatable")return state.display?.datatableEnabled!==false;if(view==="appointmentUpload")return ["ADMIN","USER"].includes(state.user?.accessRights)&&state.appointment?.moduleEnabled===true&&state.appointment?.uploadEnabled===true;return true}
function activeVehiclesApiPath(){return `/api/vehicles/active?page=${state.view==="inbound"?"inbound":"receiving"}`}

function openApp() {
  $("loginView").hidden = true; $("appView").hidden = false; $("accountName").textContent = state.user.name; $("accountRole").textContent = roleLabel(state.user.accessRights);
  $("appView").classList.toggle("inbound-kiosk-shell",state.user.accessRights==="INBOUND");
  window.scrollTo(0, 0);
  state.view = state.user.accessRights === "INBOUND" ? "inbound" : "operations"; renderNavigation(); navigate(state.view);
}

function renderNavigation() {
  const role = state.user.accessRights;
  const items = [];
  if (role !== "INBOUND") items.push(["operations","▣","งานรับสินค้า"]);
  if (role !== "INBOUND" && viewEnabled("appointmentUpload")) items.push(["appointmentUpload","↑","ข้อมูลนัดหมาย"]);
  if (role === "ADMIN" || role === "INBOUND") items.push(["inbound","▦","แผนก Inbound"]);
  if (role !== "INBOUND" && viewEnabled("dashboard")) items.push(["dashboard","▥","Dashboard"]);
  if (role !== "INBOUND" && viewEnabled("datatable")) items.push(["datatable","▤","Datatable"]);
  if (role === "ADMIN") items.push(["admin","⚙","ตั้งค่าระบบ"]);
  $("sideNav").innerHTML = items.map(i => `<button class="nav-button" data-view="${i[0]}">${i[1]} ${i[2]}</button>`).join("");
  $("mobileNav").innerHTML = items.map(i => `<button data-view="${i[0]}">${i[1]}<small>${i[2]}</small></button>`).join("");
  document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
}

async function navigate(view) {
  if(scannerState.active&&state.view==="inbound"){if(view!=="inbound")showNotice("info","กรุณาปิดกล้องก่อนเปลี่ยนหน้า");return}
  if(state.view==="dashboard"&&view!=="dashboard")cancelDashboardRequest();
  if(state.view==="appointmentUpload"&&view!=="appointmentUpload")appointmentStopWorker();
  if(!viewEnabled(view)){const message=view==="dashboard"?"Dashboard ถูกปิดการแสดงผลโดยผู้ดูแลระบบ":view==="datatable"?"Datatable ถูกปิดการแสดงผลโดยผู้ดูแลระบบ":"ขณะนี้ปิดการอัปโหลดข้อมูลนัดหมาย";await showNotice("info",message);view="operations"}
  stopCamera();
  state.view = view;setDashboardShell(view);if(view==="inbound")inboundLiveState.version=""; const titles = { operations:"งานรับสินค้า", appointmentUpload:"ข้อมูลนัดหมาย", inbound:"แผนก Inbound", dashboard:"ภาพรวมการปฏิบัติงาน", datatable:"Datatable", admin:"ตั้งค่าระบบ" };
  $("appView").classList.toggle("compact-inbound-header", view==="inbound");
  $("pageTitle").textContent = titles[view]; document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("pageContent").innerHTML = `<div class="loading">กำลังโหลดข้อมูล</div>`;
  if (view === "admin") return renderAdmin();
  if (view === "appointmentUpload") return renderAppointmentUpload();
  if (view === "dashboard") return renderDashboard();
  if (view === "datatable") return renderDatatable();
  try { const data = await api(activeVehiclesApiPath()); applyVehicleData(data); renderCurrentView(); }
  catch (error) { $("pageContent").innerHTML = `<div class="empty-state"><b>โหลดข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span></div>`; }
}

function renderCurrentView() { if (state.view === "operations") renderOperations(); else if (state.view === "inbound") renderInbound(); else if (state.view === "dashboard") renderDashboard(); else if(state.view==="datatable")renderDatatable(); }

async function refreshLiveData(){
  if(!state.user||document.hidden||scannerState.active||!["operations","dashboard","datatable"].includes(state.view)||document.activeElement?.tagName==="INPUT")return;
  if(state.view==="dashboard"){loadDashboard(false);return}
  if(state.view==="datatable"){return}
  try{const data=await api(activeVehiclesApiPath());applyVehicleData(data);renderCurrentView()}catch{}
}

async function checkInboundLiveUpdates(force=false){
  if(force)inboundLiveState.nextAllowedAt=0;
  if(!state.user||state.view!=="inbound"||document.hidden||!navigator.onLine||inboundLiveState.checking||submitState.busy||scannerState.reading||uiState.detailsOpen||Date.now()<inboundLiveState.nextAllowedAt)return;
  const input=$("autoSearch");if(input&&input.value.trim())return;
  inboundLiveState.checking=true;
  try{
    const snapshot=await api("/api/vehicles/active-version"),changed=!inboundLiveState.version||snapshot.version!==inboundLiveState.version;
    if(changed){const data=await api(activeVehiclesApiPath());applyVehicleData(data);restoreInboundMainDisplay()}
    inboundLiveState.version=String(snapshot.version||"");inboundLiveState.failures=0;inboundLiveState.nextAllowedAt=0;
  }catch{inboundLiveState.failures=Math.min(inboundLiveState.failures+1,4);inboundLiveState.nextAllowedAt=Date.now()+Math.min(60000,5000*(2**inboundLiveState.failures))}
  finally{inboundLiveState.checking=false}
}

function renderOperations() {
  const items = state.vehicles.filter(v => ["READY_FOR_RECEIVING","RECEIVING_IN_PROGRESS"].includes(v.current_status));
  const ready = items.filter(v=>v.current_status==="READY_FOR_RECEIVING");
  const called = ready.filter(v=>Number(v.queue_called_at||0)>0);
  const readyOnly = ready.filter(v=>Number(v.queue_called_at||0)<=0);
  const inProgress = items.filter(v=>v.current_status==="RECEIVING_IN_PROGRESS");
  syncOperationsDefaultFilter({all:items,ready:readyOnly,called,inProgress});
  $("pageContent").innerHTML = `<section class="summary-strip receiving-summary">${summary("พร้อมเรียก",readyOnly.length)}${summary("เรียกแล้ว",called.length)}${summary("กำลังตรวจรับ",inProgress.length)}${summary("รถในพื้นที่",state.vehicles.length)}</section><section class="receiving-group-board" aria-label="กลุ่มงานรับสินค้า"><button class="receiving-group-card" type="button" data-receiving-filter="called"><small>ต้องทำก่อน</small><b>เรียกแล้ว</b><strong>${called.length}</strong></button><button class="receiving-group-card" type="button" data-receiving-filter="ready"><small>รอเรียก</small><b>พร้อมเรียก</b><strong>${readyOnly.length}</strong></button><button class="receiving-group-card" type="button" data-receiving-filter="inProgress"><small>กำลังทำอยู่</small><b>กำลังตรวจรับ</b><strong>${inProgress.length}</strong></button><button class="receiving-group-card" type="button" data-receiving-filter="all"><small>ดูทั้งหมด</small><b>ทุกงาน</b><strong>${items.length}</strong></button></section><div class="toolbar receiving-toolbar compact-receiving-toolbar"><input id="jobSearch" placeholder="ค้นหาเลขนัดหมาย บริษัท คนขับ ทะเบียนรถ หรือประตู" value="${escapeHtml(operationsUiState.search||"")}"><button id="refreshButton">โหลดใหม่</button></div><section id="jobGrid" class="job-grid receiving-grid"></section>`;
  renderOperationsCards(items);
  $("jobSearch").addEventListener("input",e=>{operationsUiState.search=String(e.target.value||"");renderOperationsCards(items)});
  $("refreshButton").addEventListener("click",()=>navigate("operations"));
  document.querySelectorAll("[data-receiving-filter]").forEach(button=>button.addEventListener("click",()=>{operationsUiState.filter=button.dataset.receivingFilter||"all";renderOperationsCards(items)}));
  $("jobGrid").addEventListener("click",event=>{
    const button=event.target.closest("[data-receiving-action]");if(!button)return;
    const vehicle=state.vehicles.find(item=>String(item.auto_id)===button.dataset.autoId);if(!vehicle)return;
    const action=button.dataset.receivingAction;
    if(action==="call")callVehicle(vehicle,false);
    else if(action==="recall")callVehicle(vehicle,true);
    else if(action==="history")showQueueCallHistory(vehicle);
    else if(action==="more")showReceivingMore(vehicle);
    else if(action==="notice")showAdditionalCall(vehicle);
    else if(action==="reject")rejectReceiving(vehicle);
    else if(action==="start")startReceiving(vehicle);
    else if(action==="complete")completeReceiving(vehicle);
  });
}

function syncOperationsDefaultFilter(groups){
  const current=operationsUiState.filter;
  if(current && ["called","ready","inProgress","all"].includes(current))return;
  if((groups.called||[]).length)operationsUiState.filter="called";
  else if((groups.ready||[]).length)operationsUiState.filter="ready";
  else if((groups.inProgress||[]).length)operationsUiState.filter="inProgress";
  else operationsUiState.filter="all";
}

function operationsFilterLabel(filter){
  if(filter==="called")return "เรียกแล้ว รอรถเข้า";
  if(filter==="ready")return "พร้อมเรียก";
  if(filter==="inProgress")return "กำลังตรวจรับ";
  return "ทุกงาน";
}

function receivingGroupKey(vehicle){
  if(vehicle.current_status==="RECEIVING_IN_PROGRESS")return "inProgress";
  return Number(vehicle.queue_called_at||0)>0 ? "called" : "ready";
}

function renderOperationsCards(items){
  const search=(operationsUiState.search||"").trim().toLowerCase();
  const filter=operationsUiState.filter||"all";
  const searched=items.filter(v=>!search||searchable(v).includes(search));
  const selected=filter==="all"?searched:searched.filter(v=>receivingGroupKey(v)===filter);
  document.querySelectorAll("[data-receiving-filter]").forEach(button=>button.classList.toggle("is-active",(button.dataset.receivingFilter||"all")===filter));
  renderJobCards(searched,filter,selected.length);
}


function appointmentEnrichmentOf(item){return item?.appointment_enrichment||item?.appointmentEnrichment||null}
function appointmentProjectionOf(item){return appointmentEnrichmentOf(item)?.projection||null}
function appointmentDeltaLabel(minutes){const n=Number(minutes);if(!Number.isFinite(n))return"";if(n===0)return"ตรงเวลา";const abs=Math.abs(Math.round(n)),h=Math.floor(abs/60),m=abs%60,parts=[];if(h)parts.push(`${h} ชม.`);if(m||!h)parts.push(`${m} นาที`);return`${n<0?"มาก่อน":"ช้า"} ${parts.join(" ")}`}
function appointmentProjectionBits(projection){if(!projection)return[];const bits=[];if(projection.plannedAtDisplay)bits.push(`นัด ${projection.plannedAtDisplay}`);if(projection.deltaMinutes!=null)bits.push(appointmentDeltaLabel(projection.deltaMinutes));if(Array.isArray(projection.vendors)&&projection.vendors.length)bits.push(projection.vendors.join(" / "));if(Array.isArray(projection.carriers)&&projection.carriers.length)bits.push(`Carrier ${projection.carriers.join(" / ")}`);if(Array.isArray(projection.pos)&&projection.pos.length)bits.push(`PO ${projection.pos.join(", ")}`);return bits.filter(Boolean)}
function appointmentOperationalStrip(item,page,compact=false){const projection=appointmentProjectionOf(item);if(!projection)return"";const bits=appointmentProjectionBits(projection);if(!bits.length)return"";return`<div class="appointment-operational-strip ${compact?"is-compact":""}" data-appointment-page="${escapeHtml(page)}"><b>แผนนัดหมาย</b><span>${bits.map(escapeHtml).join(" · ")}</span></div>`}
function appointmentInline(item,page){const projection=appointmentProjectionOf(item);if(!projection)return"";const bits=appointmentProjectionBits(projection);return bits.length?`<small class="appointment-inline">${bits.slice(0,3).map(escapeHtml).join(" · ")}</small>`:""}
function dashboardAppointmentPlanHtml(data){const p=data?.appointmentPlan;if(!p?.enabled)return"";return`<section class="appointment-dashboard-strip"><span><small>แผนนัดหมาย</small><b>${Number(p.matched||0)} จับคู่</b></span><span><small>มาก่อน</small><b>${Number(p.early||0)}</b></span><span><small>ตรงเวลา</small><b>${Number(p.onTime||0)}</b></span><span><small>ช้า</small><b>${Number(p.late||0)}</b></span><span><small>ไม่พบ</small><b>${Number(p.notMatched||0)}</b></span></section>`}

function renderJobCards(items, filter="all", selectedCount=0) {
  const grid=$("jobGrid");
  if(!grid)return;
  grid.dataset.filter=filter||"all";
  grid.dataset.selectedEmpty=selectedCount>0?"0":"1";
  const emptyText=filter==="called"?"ยังไม่มีงานที่เรียกแล้ว":filter==="ready"?"ยังไม่มีงานพร้อมเรียก":filter==="inProgress"?"ยังไม่มีงานที่กำลังตรวจรับ":"ไม่มีงานรอตรวจรับ";
  if(!items.length){
    grid.innerHTML=`<div class="empty-state receiving-empty"><b>ไม่มีรายการที่ตรงกับการค้นหา</b><span>ลองค้นหาใหม่ หรือกดโหลดใหม่</span></div>`;
    return;
  }
  const cards=items.map(v=>{
    const inProgress=v.current_status==="RECEIVING_IN_PROGRESS";
    const busy=receivingState.busyIds.has(String(v.auto_id));
    const hasCalls=Number(v.queue_call_count||0)>0;
    const called=!inProgress&&Number(v.queue_called_at||0)>0;
    const group=receivingGroupKey(v);
    const mobileDoor=Number(v.use_door)===0?"ไม่ใช้ประตู":v.door_code||"ยังไม่ระบุ";
    const desktopDoor=Number(v.use_door)===0?"งานนี้ไม่ใช้ประตู":v.door_code||"ยังไม่ระบุประตู";
    const mobileStatus=inProgress?"กำลังตรวจรับ":called?"เรียกแล้ว":"พร้อมเรียก";
    const desktopStatus=inProgress?statusLabel(v.current_status):called?"เรียกแล้ว รอรถเข้า":"พร้อมเรียก";
    const plate=joinText(v.vehicle_plate,v.province)||"ไม่ระบุทะเบียน";
    const mobileStageTime=inProgress
      ? `<span><small>เริ่มตรวจ</small><b>${formatDate(v.receiving_started_at)}</b></span><span><small>ใช้เวลา</small><b data-duration-start="${Number(v.receiving_started_at||unixNow())}">${formatDuration(unixNow()-Number(v.receiving_started_at||unixNow()))}</b></span>`
      : called
        ? `<span><small>เรียกล่าสุด</small><b>${formatDate(v.queue_called_at)}</b></span><span><small>เรียกแล้ว</small><b>${Number(v.queue_call_count||1)} ครั้ง</b></span>`
        : `<span><small>รอเรียก</small><b>${formatDuration(v.stage_elapsed_seconds)}</b></span><span><small>ประตู</small><b>${escapeHtml(mobileDoor)}</b></span>`;
    const mobileActions=inProgress
      ? `<button class="complete-button receiving-mobile-main" data-receiving-action="complete" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"รับสินค้าเสร็จ"}</button><button class="outline-button receiving-mobile-side" data-receiving-action="more" data-auto-id="${escapeHtml(v.auto_id)}">เพิ่มเติม</button>`
      : called
        ? `${state.queueRecall?.enabled!==false?`<button class="outline-button recall-button receiving-mobile-main" data-receiving-action="recall" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>เรียกซ้ำ / เปลี่ยนประตู</button>`:`<button class="outline-button receiving-mobile-main" disabled>ปิดการเรียกซ้ำ</button>`}<button class="start-receiving-button receiving-mobile-side" data-receiving-action="start" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"เริ่มตรวจรับ"}</button>`
        : `<button class="primary call-vehicle-button receiving-mobile-main" data-receiving-action="call" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"เรียกรถ"}</button><button class="start-receiving-button receiving-mobile-side" data-receiving-action="start" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>เริ่มตรวจรับ</button>`;
    const callInfo=hasCalls?`<div class="queue-call-strip"><span><small>เรียกล่าสุด</small><b>${formatDate(v.queue_called_at)}</b></span><span><small>จำนวนครั้ง</small><b>${Number(v.queue_call_count||1)} ครั้ง</b></span>${Number(v.use_door)!==0&&v.door_code?`<span><small>ประตูล่าสุด</small><b>${escapeHtml(v.door_code)}</b></span>`:""}<button class="queue-history-button" type="button" data-receiving-action="history" data-auto-id="${escapeHtml(v.auto_id)}">ดูประวัติการเรียก</button></div>`:"";
    const noticeInfo=v.queue_notice_at?`<div class="queue-notice-latest"><span class="queue-notice-icon">${receivingNoticeIcon("sound")}</span><div><small>เรียกเพิ่มเติมล่าสุด</small><b>${escapeHtml(queueNoticeTypeLabel(v.queue_notice_type,v.queue_notice_door_code))}</b></div><time>${formatDate(v.queue_notice_at)}</time></div>`:"";
    const desktopActions=inProgress
      ? `<button class="complete-button" data-receiving-action="complete" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"รับสินค้าเสร็จ"}</button>`
      : called
        ? `${state.queueRecall?.enabled!==false?`<button class="outline-button recall-button" data-receiving-action="recall" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>เรียกซ้ำ${Number(v.use_door)!==0&&state.queueRecall?.allowDoorChange!==false?" / เปลี่ยนประตู":""}</button>`:`<button class="outline-button recall-button" type="button" disabled>ปิดการเรียกซ้ำ</button>`}<button class="start-receiving-button" data-receiving-action="start" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"เริ่มตรวจรับ"}</button>`
        : `<button class="primary call-vehicle-button" data-receiving-action="call" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>${busy?"กำลังบันทึก":"เรียกรถ"}</button><button class="start-receiving-button" data-receiving-action="start" data-auto-id="${escapeHtml(v.auto_id)}" ${busy?"disabled":""}>เริ่มตรวจรับ</button>`;
    const desktop=`<section class="job-card receiving-card receiving-desktop-view ${inProgress?"is-progress":called?"is-called":"is-ready"}" style="--job-color:${safeColor(v.alert_color)}"><div class="job-head"><div><small>เลขนัดหมาย</small><h2>${escapeHtml(v.appointment_no||"ไม่ระบุ")}</h2></div><div class="alert-stack"><div class="receiving-head-tools"><span class="badge receiving-badge">${escapeHtml(desktopStatus)}</span><button class="receiving-more-button" type="button" data-receiving-action="more" data-auto-id="${escapeHtml(v.auto_id)}" title="ตัวเลือกเพิ่มเติม" aria-label="ตัวเลือกเพิ่มเติม">${receivingNoticeIcon("more")}<span>เพิ่มเติม</span></button></div><span class="alert-chip">${alertLevelLabel(v.alert_level)} · <b data-duration-start="${Number(v.alert_started_at||v.gate_in_at||0)}">${formatDuration(v.stage_elapsed_seconds)}</b></span></div></div><div class="dense-grid receiving-details"><div class="wide"><small>บริษัท</small><b>${escapeHtml(v.company_name||"ไม่ระบุ")}</b></div><div><small>คนขับรถ</small><b>${escapeHtml(v.driver_name||"ไม่ระบุ")}</b></div><div><small>ทะเบียนรถ</small><b>${escapeHtml(joinText(v.vehicle_plate,v.province))}</b></div><div><small>ประตูรับสินค้า</small><b>${escapeHtml(desktopDoor)}</b></div><div><small>Gate In</small><b>${formatDate(v.gate_in_at)}</b></div>${inProgress?`<div><small>เริ่มตรวจรับ</small><b>${formatDate(v.receiving_started_at)}</b></div><div><small>ใช้เวลาแล้ว</small><b data-duration-start="${Number(v.receiving_started_at||unixNow())}">${formatDuration(unixNow()-Number(v.receiving_started_at||unixNow()))}</b></div>`:`<div><small>ยื่นเอกสาร</small><b>${formatDate(v.document_submitted_at)}</b></div>`}</div>${appointmentOperationalStrip(v,"receiving")}${callInfo}${noticeInfo}<div class="receiving-actionbar ${inProgress?"":"multiple-actions"}">${desktopActions}</div></section>`;
    const mobile=`<section class="receiving-mobile-card receiving-mobile-view ${inProgress?"is-progress":called?"is-called":"is-ready"}" style="--job-color:${safeColor(v.alert_color)}"><header class="receiving-mobile-head"><div><b>${escapeHtml(v.appointment_no||"ไม่ระบุ")}</b><small>${escapeHtml(v.company_name||"ไม่ระบุบริษัท")}</small></div><div><span class="receiving-mobile-status">${escapeHtml(mobileStatus)}</span><button class="receiving-mobile-more" type="button" data-receiving-action="more" data-auto-id="${escapeHtml(v.auto_id)}" aria-label="เพิ่มเติม">${receivingNoticeIcon("more")}</button></div></header><div class="receiving-mobile-info"><span><small>คนขับ</small><b>${escapeHtml(v.driver_name||"ไม่ระบุ")}</b></span><span><small>ทะเบียน</small><b>${escapeHtml(plate)}</b></span><span><small>ประตู</small><b>${escapeHtml(mobileDoor)}</b></span></div>${appointmentOperationalStrip(v,"receiving",true)}<div class="receiving-mobile-time">${mobileStageTime}${hasCalls&&called?`<button type="button" data-receiving-action="history" data-auto-id="${escapeHtml(v.auto_id)}">ประวัติเรียก</button>`:""}</div><div class="receiving-mobile-actions">${mobileActions}</div></section>`;
    return `<article class="receiving-card-pair" data-receiving-group="${group}">${desktop}${mobile}</article>`;
  }).join("");
  grid.innerHTML=cards+`<div class="empty-state receiving-mobile-filter-empty"><b>${emptyText}</b><span>เลือกกลุ่มงานอื่น หรือค้นหาใหม่</span></div>`;
}

function receivingNoticeIcon(type){
  const icons={
    sound:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h3l4 3V7L7 10H4Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 9.2a4 4 0 0 1 0 5.6M16.5 6.8a7.4 7.4 0 0 1 0 10.4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    document:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4V20H6Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3.5V8h4M9 12h6M9 15h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    door:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h11v17H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 6.5h5v14H9z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="12.8" cy="13.4" r=".8" fill="currentColor"/></svg>`,
    more:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/></svg>`,
    reject:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m9 9 6 6m0-6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    truck:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h10v8h-10zM13.5 10h3l2 2.4v3.1h-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="17.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`
  };return icons[type]||icons.sound;
}
function queueNoticeTypeLabel(type,door){
  const code=String(type||"").toUpperCase();
  if(code==="NOTICE_DOCUMENT_ROOM")return"ติดต่อห้องเอกสาร";
  if(code==="NOTICE_DOOR")return door?`ติดต่อที่ประตู ${door}`:"ติดต่อที่ประตู";
  if(code==="NOTICE_VEHICLE")return"ติดต่อที่รถของท่าน";
  return"เรียกเพิ่มเติม";
}
async function showReceivingMore(vehicle){
  if(!vehicle||!window.Swal)return;
  const result=await Swal.fire({
    title:"เพิ่มเติม",
    html:`<div class="receiving-more-menu">
      <button type="button" data-more-action="notice"><span>${receivingNoticeIcon("sound")}</span><div><b>เรียกเพิ่มเติม</b><small>ประกาศข้อความเพิ่มเติมให้คนขับ</small></div></button>
      <button type="button" data-more-action="reject" class="is-reject"><span>${receivingNoticeIcon("reject")}</span><div><b>ปฏิเสธรับสินค้า</b><small>บันทึกเหตุผลและผู้รับทราบก่อนนำออกจากคิว</small></div></button>
    </div>`,
    showConfirmButton:false,showCancelButton:true,cancelButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal receiving-more-swal"},buttonsStyling:false,width:430,
    didOpen:()=>document.querySelectorAll("[data-more-action]").forEach(button=>button.addEventListener("click",()=>{const action=button.dataset.moreAction;Swal.close();window.setTimeout(()=>action==="reject"?rejectReceiving(vehicle):showAdditionalCall(vehicle),80)}))
  });
  return result;
}

async function rejectReceiving(vehicle){
  if(!vehicle||!window.Swal)return;
  const autoId=String(vehicle.auto_id||"");if(!autoId||receivingState.busyIds.has(autoId))return;
  let options;
  try{options=await api("/api/receiving/rejection-options")}catch(error){await showNotice("error",error.message||"โหลดตัวเลือกปฏิเสธการรับสินค้าไม่สำเร็จ");return}
  const reasons=Array.isArray(options.reasons)?options.reasons:[],supervisors=Array.isArray(options.supervisors)?options.supervisors:[];
  if(!reasons.length){await showNotice("warning","ยังไม่มีเหตุผลปฏิเสธที่เปิดใช้งาน กรุณาให้ Admin ตั้งค่าก่อน");return}
  if(!supervisors.length){await showNotice("warning","ยังไม่มีรายชื่อหัวหน้างานที่รับทราบ กรุณาให้ Admin เพิ่มรายชื่อก่อน");return}
  const defaultReason=reasons.find(item=>Number(item.is_default)===1)||reasons[0];
  const reasonOptions=reasons.map(item=>`<option value="${escapeHtml(item.reason_id)}" data-require-note="${Number(item.require_note)||0}" ${item.reason_id===defaultReason.reason_id?"selected":""}>${escapeHtml(item.reason_label)}</option>`).join("");
  const supervisorOptions=supervisors.map(item=>`<option value="${escapeHtml(item.supervisor_id)}">${escapeHtml(item.supervisor_name)}${item.position?` · ${escapeHtml(item.position)}`:""}</option>`).join("");
  const result=await Swal.fire({
    title:"ปฏิเสธการรับสินค้า",
    html:`<div class="receiving-reject-dialog">
      <div class="receiving-reject-vehicle"><small>เลขนัดหมาย</small><b>${escapeHtml(vehicle.appointment_no||autoId)}</b><span>${escapeHtml(vehicle.company_name||"ไม่ระบุบริษัท")}</span></div>
      <label><span>เหตุผลการปฏิเสธ</span><select id="receivingRejectReason">${reasonOptions}</select></label>
      <label id="receivingRejectDetailWrap"><span>รายละเอียดเพิ่มเติม <em id="receivingRejectDetailRequired"></em></span><textarea id="receivingRejectDetail" rows="3" maxlength="500" placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"></textarea></label>
      <label><span>หัวหน้างานที่รับทราบ</span><select id="receivingRejectSupervisor"><option value="">เลือกหัวหน้างาน</option>${supervisorOptions}</select></label>
      <fieldset><legend>การคืนเอกสาร</legend><label class="reject-radio"><input type="radio" name="rejectDocumentReturn" value="1" checked><span><b>ต้องคืนเอกสาร</b><small>ส่งรายการไป Inbound เพื่อคืนเอกสาร</small></span></label><label class="reject-radio"><input type="radio" name="rejectDocumentReturn" value="0"><span><b>ไม่ต้องคืนเอกสาร</b><small>ส่งรายการไปรอออกจากพื้นที่</small></span></label></fieldset>
    </div>`,
    showCancelButton:true,confirmButtonText:"ยืนยันปฏิเสธ",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,buttonsStyling:false,width:500,
    customClass:{...swalClasses(),popup:"wfv-swal receiving-reject-swal",confirmButton:"wfv-swal-confirm receiving-reject-confirm"},
    didOpen:()=>{const reason=$("receivingRejectReason"),detail=$("receivingRejectDetail"),required=$("receivingRejectDetailRequired");const sync=()=>{const option=reason?.selectedOptions?.[0],must=Number(option?.dataset.requireNote||0)===1;if(required)required.textContent=must?"จำเป็น":"";if(detail)detail.placeholder=must?"กรุณาระบุรายละเอียด":"ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"};reason?.addEventListener("change",sync);sync()},
    preConfirm:()=>{const reasonEl=$("receivingRejectReason"),selected=reasonEl?.selectedOptions?.[0],reasonId=String(reasonEl?.value||""),detailNote=String($("receivingRejectDetail")?.value||"").trim(),supervisorId=String($("receivingRejectSupervisor")?.value||""),requireDocumentReturn=document.querySelector('input[name="rejectDocumentReturn"]:checked')?.value!=="0";if(!reasonId){Swal.showValidationMessage("กรุณาเลือกเหตุผล");return false}if(Number(selected?.dataset.requireNote||0)===1&&!detailNote){Swal.showValidationMessage("กรุณากรอกรายละเอียดเพิ่มเติม");return false}if(!supervisorId){Swal.showValidationMessage("กรุณาเลือกหัวหน้างานที่รับทราบ");return false}return{reasonId,detailNote,supervisorId,requireDocumentReturn}}
  });
  if(!result.isConfirmed)return;
  receivingState.busyIds.add(autoId);if(state.view==="operations")renderCurrentView();const idempotencyKey=createIdempotencyKey();
  try{
    Swal.fire({title:"กำลังบันทึกการปฏิเสธ",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:360});
    const response=await api("/api/workflow/receiving-reject",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId,idempotencyKey,...result.value}});
    mergeVehicleUpdate(response.vehicle);if(state.view==="operations"){const data=await api(activeVehiclesApiPath());applyVehicleData(data);renderCurrentView()}else if(state.view==="datatable")await loadDatatable(true);playFeedbackSound(response.duplicate?"duplicate":"success");
    await Swal.fire({icon:"success",title:"บันทึกการปฏิเสธแล้ว",text:response.message||"นำรายการออกจากงานรับสินค้าแล้ว",timer:1800,showConfirmButton:false,customClass:swalClasses(),width:390});
  }catch(error){if(error.data?.vehicle)mergeVehicleUpdate(error.data.vehicle);playFeedbackSound("error");await showNotice("error",error.message||"บันทึกการปฏิเสธไม่สำเร็จ")}
  finally{receivingState.busyIds.delete(autoId);if(state.view==="operations")renderCurrentView()}
}

async function showAdditionalCall(vehicle){
  if(!vehicle||!window.Swal)return;
  const useDoor=Number(vehicle.use_door)!==0,hasDoors=useDoor&&Array.isArray(state.activeDoors)&&state.activeDoors.length>0;
  const html=`${vehicleDetailsHtml(vehicle,vehicle.auto_id)}<div class="extra-call-choice-grid">
    <button type="button" data-extra-call="NOTICE_DOCUMENT_ROOM"><span>${receivingNoticeIcon("document")}</span><div><b>ติดต่อห้องเอกสาร</b><small>ประกาศให้พนักงานขับรถมาติดต่อห้องเอกสาร</small></div></button>
    <button type="button" data-extra-call="NOTICE_DOOR" ${hasDoors?"":"disabled"}><span>${receivingNoticeIcon("door")}</span><div><b>ติดต่อที่ประตู</b><small>${hasDoors?"เลือกประตูที่เปิดใช้งานแล้วประกาศ":"ยังไม่มีประตูที่เปิดใช้งาน"}</small></div></button>
    <button type="button" data-extra-call="NOTICE_VEHICLE"><span>${receivingNoticeIcon("truck")}</span><div><b>ติดต่อที่รถของท่าน</b><small>ประกาศให้พนักงานขับรถกลับไปติดต่อที่รถ</small></div></button>
  </div><p class="extra-call-note">การเรียกเพิ่มเติมไม่เปลี่ยนสถานะงานและไม่เปลี่ยนประตูของรถ</p>`;
  await Swal.fire({title:"เรียกเพิ่มเติม",html,showConfirmButton:false,showCancelButton:true,cancelButtonText:"ปิด",customClass:swalClasses(),buttonsStyling:false,width:540,didOpen:()=>{
    document.querySelectorAll("[data-extra-call]").forEach(button=>button.addEventListener("click",async()=>{
      const type=button.dataset.extraCall;if(!type||button.disabled)return;Swal.close();
      let doorCode=null;if(type==="NOTICE_DOOR"){doorCode=await chooseNoticeDoor(vehicle);if(!doorCode)return}
      await submitQueueNotice(vehicle,type,doorCode);
    }))
  }});
}
async function chooseNoticeDoor(vehicle){
  const doors=[...new Set(state.activeDoors||[])];if(!doors.length){await showNotice("warning","ยังไม่มีประตูที่เปิดใช้งาน");return null}
  const defaultDoor=doors.includes(String(vehicle.door_code||""))?String(vehicle.door_code):doors[0];
  if(window.Swal){
    const options=doors.map(code=>`<option value="${escapeHtml(code)}"></option>`).join("");
    const result=await Swal.fire({title:"เลือกประตูที่ต้องการให้ติดต่อ",html:`<div class="notice-door-picker"><label><span>ค้นหาหรือพิมพ์รหัสประตู</span><input id="noticeDoorCode" list="noticeDoorList" value="${escapeHtml(defaultDoor)}" autocomplete="off" placeholder="เช่น R12"><datalist id="noticeDoorList">${options}</datalist></label><small>เลือกได้เฉพาะประตูที่ Admin เปิดใช้งานอยู่</small></div>`,showCancelButton:true,confirmButtonText:"ใช้ประตูนี้",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:430,preConfirm:()=>{const code=String($("noticeDoorCode")?.value||"").trim().toUpperCase();if(!doors.includes(code)){Swal.showValidationMessage("กรุณาเลือกประตูที่เปิดใช้งาน");return false}return code}});
    return result.isConfirmed?result.value:null;
  }
  const entered=window.prompt("กรอกรหัสประตู",defaultDoor);if(entered===null)return null;const code=String(entered).trim().toUpperCase();return doors.includes(code)?code:null;
}
async function submitQueueNotice(vehicle,noticeType,doorCode=null){
  const autoId=String(vehicle?.auto_id||"");if(!autoId||receivingState.busyIds.has(autoId))return;
  receivingState.busyIds.add(autoId);renderCurrentView();
  try{
    if(window.Swal)Swal.fire({title:"กำลังส่งการเรียกเพิ่มเติม",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:360});
    const idempotencyKey=`notice:${autoId}:${noticeType}:${doorCode||"-"}:${Date.now()}:${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
    const result=await api("/api/workflow/queue-notice",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId,noticeType,doorCode,idempotencyKey}});
    const data=await api(activeVehiclesApiPath());applyVehicleData(data);renderCurrentView();
    if(window.Swal)await Swal.fire({icon:"success",title:"ส่งการเรียกเพิ่มเติมแล้ว",text:result.message||queueNoticeTypeLabel(noticeType,doorCode),timer:1600,showConfirmButton:false,customClass:swalClasses(),width:390});
  }catch(error){await showNotice("error",error.message||"ส่งการเรียกเพิ่มเติมไม่สำเร็จ")}
  finally{receivingState.busyIds.delete(autoId);if(state.view==="operations")renderCurrentView()}
}

function queueHistoryTypeLabel(type){return({FIRST:"เรียกครั้งแรก",RECALL:"เรียกซ้ำ",DOOR_CHANGED:"เปลี่ยนประตูและเรียก"})[String(type||"").toUpperCase()]||"เรียกรถ"}
function queueHistoryReasonLabel(reason){return reason==="FIRST"?"":(QUEUE_REASON_LABELS[String(reason||"").toUpperCase()]||"เรียกซ้ำทั่วไป")}
function queueHistoryDoorText(call,useDoor){
  if(!useDoor)return"";
  const current=String(call?.doorCode||"").trim(),previous=String(call?.previousDoorCode||"").trim(),type=String(call?.callType||"").toUpperCase();
  if(type==="DOOR_CHANGED"&&previous&&current&&previous!==current)return`${escapeHtml(previous)} → ${escapeHtml(current)}`;
  return current?escapeHtml(current):"ไม่ระบุประตู";
}
async function showQueueCallHistory(vehicle){
  const autoId=String(vehicle?.auto_id||"").trim();if(!autoId||Number(vehicle?.queue_call_count||0)<=0)return;
  try{
    if(window.Swal)Swal.fire({title:"กำลังโหลดประวัติการเรียก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:430});
    const data=await api(`/api/workflow/queue-call-history?autoId=${encodeURIComponent(autoId)}`),calls=Array.isArray(data.calls)?data.calls:[],useDoor=Boolean(data.useDoor);
    const items=calls.map((call,index)=>{
      const type=String(call.callType||"").toUpperCase(),reason=queueHistoryReasonLabel(call.reasonCode),door=queueHistoryDoorText(call,useDoor),note=String(call.note||"").trim();
      return `<article class="queue-history-item ${index===0?"is-latest":""}"><div class="queue-history-marker"><span>${Number(call.callNo||0)||""}</span></div><div class="queue-history-content"><header><b>${escapeHtml(queueHistoryTypeLabel(type))}</b><time>${formatDate(call.calledAt)}</time></header>${reason?`<p>${escapeHtml(reason)}</p>`:""}<div class="queue-history-meta">${door?`<span><small>ประตู</small><strong>${door}</strong></span>`:""}<span><small>ผู้ดำเนินการ</small><strong>${escapeHtml(call.actorName||"ระบบ")}</strong></span></div>${note?`<div class="queue-history-note">${escapeHtml(note)}</div>`:""}</div></article>`;
    }).join("");
    const first=data.firstCalledAt?formatDate(data.firstCalledAt):"-",last=data.lastCalledAt?formatDate(data.lastCalledAt):"-",elapsed=data.firstCalledAt?formatDuration(Math.max(0,Number(data.receivingStartedAt||unixNow())-Number(data.firstCalledAt))):"-";
    const truncation=Number(data.total||0)>calls.length?`<div class="queue-history-more">แสดง ${calls.length} รายการล่าสุด จากทั้งหมด ${Number(data.total||0)} ครั้ง</div>`:"";
    const html=`<div class="queue-history-modal"><div class="queue-history-vehicle"><small>หมายเลขนัดหมาย</small><b>${escapeHtml(data.appointmentNo||vehicle.appointment_no||autoId)}</b></div><div class="queue-history-summary"><span><small>รวม</small><b>${Number(data.total||0)} ครั้ง</b></span><span><small>เรียกครั้งแรก</small><b>${escapeHtml(first)}</b></span><span><small>${data.receivingStartedAt?"ถึงเริ่มตรวจรับ":"เรียกมาแล้ว"}</small><b>${escapeHtml(elapsed)}</b></span></div>${truncation}<div class="queue-history-list">${items||`<div class="empty-state">ยังไม่มีประวัติการเรียก</div>`}</div><div class="queue-history-last">เรียกล่าสุด ${escapeHtml(last)}</div></div>`;
    if(window.Swal)await Swal.fire({title:"ประวัติการเรียกรถ",html,confirmButtonText:"ปิด",customClass:swalClasses(),buttonsStyling:false,width:590});
  }catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message)}
}

function queueReasonOptions(selected="GENERAL",usesDoor=true){
  const allowed=new Set(Array.isArray(state.queueRecall?.enabledReasons)?state.queueRecall.enabledReasons:Object.keys(QUEUE_REASON_LABELS));
  return Object.entries(QUEUE_REASON_LABELS).filter(([value])=>allowed.has(value)&&(usesDoor||value!=="DOOR_CHANGE")).map(([value,label])=>`<option value="${value}" ${value===selected?"selected":""}>${label}</option>`).join("");
}

async function callVehicle(vehicle,isRecall=false){
  const autoId=String(vehicle.auto_id);if(receivingState.busyIds.has(autoId))return;
  if(isRecall&&state.queueRecall?.enabled===false){await showNotice("warning","ผู้ดูแลปิดการเรียกรถซ้ำไว้");return}
  const usesDoor=Number(vehicle.use_door)!==0,requiresDoor=usesDoor&&Number(vehicle.require_door)!==0,availableDoors=[...new Set(state.activeDoors||[])];
  if(usesDoor&&requiresDoor&&!availableDoors.length){await showNotice("warning","ยังไม่มีประตูที่เปิดใช้งาน กรุณาติดต่อผู้ดูแล");return}
  const parsed=parseDoorCode(vehicle.door_code),defaultPrefix=parsed.prefix||"R",defaultNumber=parsed.number||"";
  let payload={doorCode:usesDoor?(vehicle.door_code||null):null,reasonCode:isRecall?"GENERAL":"FIRST",note:""};
  if(window.Swal){
    const prefixOptions=["R","S","RR","RS","SR","SS"].map(prefix=>`<option value="${prefix}" ${prefix===defaultPrefix?"selected":""}>${prefix}</option>`).join("");
    const doorHtml=usesDoor?`<div class="clean-door-choice"><div class="door-picker clean-door-picker"><label><span>ตัวอักษรหน้าประตู</span><select id="callDoorPrefix">${prefixOptions}</select></label><label><span>หมายเลขประตู</span><input id="callDoorNumber" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${escapeHtml(defaultNumber)}" placeholder="กรอกตัวเลข"></label></div>${requiresDoor?`<p class="door-note clean-note">กรุณาระบุประตูก่อนเรียกรถ</p>`:`<label class="no-door-choice"><input id="callNoDoor" type="checkbox" ${vehicle.door_code?"":"checked"}> ไม่ระบุประตู</label>`}</div>`:`<p class="door-note clean-note">ระบบปิดการระบุประตู การประกาศจะไม่อ่านหมายเลขประตู</p>`;
    const reasonHtml=isRecall?`<div class="recall-reason-box"><label><span>เหตุผลที่เรียกอีกครั้ง</span><select id="queueReason">${queueReasonOptions("GENERAL",usesDoor)}</select></label><label><span>หมายเหตุ (ไม่บังคับ)</span><input id="queueReasonNote" type="text" maxlength="160" placeholder="ระบุเพิ่มเติมเมื่อจำเป็น"></label></div>`:"";
    const result=await Swal.fire({title:isRecall?"เรียกรถอีกครั้ง":"เรียกรถเข้าตรวจรับ",html:`${vehicleDetailsHtml(vehicle,autoId)}${reasonHtml}${doorHtml}`,showCancelButton:true,confirmButtonText:isRecall?"เรียกอีกครั้ง":"เรียกรถ",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:swalClasses(),buttonsStyling:false,width:460,didOpen:()=>{
      const checkbox=$("callNoDoor"),prefix=$("callDoorPrefix"),number=$("callDoorNumber");const sync=()=>{const disabled=Boolean(checkbox?.checked);if(prefix)prefix.disabled=disabled;if(number){number.disabled=disabled;if(disabled)number.value=""}};checkbox?.addEventListener("change",sync);number?.addEventListener("input",()=>{number.value=number.value.replace(/\D/g,"").slice(0,3)});sync();
    },preConfirm:()=>{
      let doorCode=null;
      if(usesDoor&&!$("callNoDoor")?.checked){
        const prefix=String($("callDoorPrefix")?.value||"R"),number=String($("callDoorNumber")?.value||"").replace(/\D/g,"");
        if(!number){if(requiresDoor){Swal.showValidationMessage("กรุณากรอกหมายเลขประตู");return false}}
        else{doorCode=`${prefix}${number}`;if(!availableDoors.includes(doorCode)){Swal.showValidationMessage(`ประตู ${doorCode} ยังไม่ได้เปิดใช้งาน`);return false}}
      }
      const reasonCode=isRecall?String($("queueReason")?.value||"GENERAL"):"FIRST";
      if(isRecall&&reasonCode==="DOOR_CHANGE"&&usesDoor&&state.queueRecall?.requireNewDoorOnChange!==false&&String(doorCode||"")===String(vehicle.door_code||"")){Swal.showValidationMessage("กรุณาเลือกประตูใหม่");return false}
      return{doorCode,reasonCode,note:isRecall?String($("queueReasonNote")?.value||"").trim():""};
    }});
    if(!result.isConfirmed)return;payload=result.value;
  }else{
    if(usesDoor){
      const entered=window.prompt("กรอกรหัสประตู เช่น R07 (เว้นว่างได้เมื่อไม่บังคับ)",vehicle.door_code||"");if(entered===null)return;
      const clean=String(entered||"").trim().toUpperCase();if(clean){if(!availableDoors.includes(clean)){showNotice("warning",`ประตู ${clean} ยังไม่ได้เปิดใช้งาน`);return}payload.doorCode=clean}else if(requiresDoor){showNotice("warning","กรุณาระบุประตูรับสินค้า");return}else payload.doorCode=null;
    }
    if(isRecall)payload.reasonCode="GENERAL";
    if(!window.confirm(`${isRecall?"ยืนยันเรียกรถอีกครั้ง":"ยืนยันเรียกรถ"} ${vehicle.appointment_no||autoId}`))return;
  }
  await runQueueCall(vehicle,payload);
}

async function runQueueCall(vehicle,payload){
  const autoId=String(vehicle.auto_id);receivingState.busyIds.add(autoId);if(state.view==="operations")renderOperations();
  const idempotencyKey=createIdempotencyKey();
  try{
    if(window.Swal)Swal.fire({title:"กำลังเรียกรถ",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});
    const result=await api("/api/workflow/queue-call",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId,doorCode:payload?.doorCode||null,reasonCode:payload?.reasonCode||"GENERAL",note:payload?.note||"",idempotencyKey}});
    mergeVehicleUpdate(result.vehicle);receivingState.busyIds.delete(autoId);if(state.view==="operations")renderOperations();else if(state.view==="datatable")await loadDatatable(true);playFeedbackSound(result.duplicate?"duplicate":"success");
    const type=result.queueCall?.callType,title=type==="FIRST"?"เรียกรถแล้ว":type==="DOOR_CHANGED"?"เปลี่ยนประตูและเรียกรถแล้ว":"เรียกรถซ้ำแล้ว";
    if(window.Swal)await Swal.fire({icon:result.duplicate?"warning":"success",title,html:`<p class="swal-message">${escapeHtml(result.message||title)}</p>`,timer:1900,timerProgressBar:true,showConfirmButton:false,customClass:swalClasses(),width:390});else showKioskMessage(result.message||title,true);
  }catch(error){receivingState.busyIds.delete(autoId);if(error.data?.vehicle)mergeVehicleUpdate(error.data.vehicle);if(state.view==="operations")renderOperations();playFeedbackSound("error");await showNotice("error",error.message)}
}

async function startReceiving(vehicle){
  const autoId=String(vehicle.auto_id);if(receivingState.busyIds.has(autoId))return;
  let doorCode=null;
  const usesDoor=Number(vehicle.use_door)!==0,requiresDoor=usesDoor&&Number(vehicle.require_door)!==0,availableDoors=[...new Set(state.activeDoors||[])];
  if(usesDoor&&requiresDoor&&!availableDoors.length){
    await showNotice("warning","ยังไม่มีประตูที่เปิดใช้งาน กรุณาติดต่อผู้ดูแล");
    return;
  }
  const currentDoor=String(vehicle.door_code||"").toUpperCase(),currentMatch=currentDoor.match(/^(SS|RR|SR|RS|S|R)(\d{1,3})$/),defaultPrefix=currentMatch?.[1]||"R",defaultNumber=currentMatch?.[2]||"";
  if(window.Swal){
    const prefixOptions=["R","S","RR","RS","SR","SS"].map(prefix=>`<option value="${prefix}" ${prefix===defaultPrefix?"selected":""}>${prefix}</option>`).join("");
    const doorHtml=usesDoor?`<div class="clean-door-choice"><div class="door-picker clean-door-picker"><label><span>ตัวอักษรหน้าประตู</span><select id="doorPrefix">${prefixOptions}</select></label><label><span>หมายเลขประตู</span><input id="doorNumber" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" autocomplete="off" value="${escapeHtml(defaultNumber)}" placeholder="กรอกตัวเลข"></label></div>${requiresDoor?`<p class="door-note clean-note">กรุณาระบุประตูก่อนเริ่มตรวจรับ</p>`:`<label class="no-door-choice"><input id="noDoor" type="checkbox"> ไม่ระบุประตู</label>`}</div>`:`<p class="door-note clean-note">งานนี้ไม่ต้องระบุประตู</p>`;
    const result=await Swal.fire({title:"เริ่มตรวจรับสินค้า",html:`${vehicleDetailsHtml(vehicle,autoId)}${doorHtml}`,showCancelButton:true,confirmButtonText:"เริ่มตรวจรับ",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:{...swalClasses(),confirmButton:"wfv-swal-confirm wfv-swal-start"},buttonsStyling:false,width:440,didOpen:()=>{const checkbox=$("noDoor"),prefix=$("doorPrefix"),number=$("doorNumber");const sync=()=>{const disabled=Boolean(checkbox?.checked);if(prefix)prefix.disabled=disabled;if(number){number.disabled=disabled;if(disabled)number.value=""}};checkbox?.addEventListener("change",sync);number?.addEventListener("input",()=>{number.value=number.value.replace(/\D/g,"").slice(0,3)});sync();if(usesDoor&&!checkbox?.checked)window.setTimeout(()=>number?.focus(),80)},preConfirm:()=>{if(!usesDoor)return null;if($("noDoor")?.checked)return null;const prefix=String($("doorPrefix")?.value||"R"),number=String($("doorNumber")?.value||"").replace(/\D/g,"");if(!number){if(requiresDoor){Swal.showValidationMessage("กรุณากรอกหมายเลขประตู");return false}return null}const selected=`${prefix}${number}`;if(!availableDoors.includes(selected)){Swal.showValidationMessage(`ประตู ${selected} ยังไม่ได้เปิดใช้งาน`);return false}return selected}});
    if(!result.isConfirmed)return;doorCode=result.value;
  }else{
    if(usesDoor){
      const prefix=window.prompt("กรอกตัวอักษรหน้าประตู: S, R, SS, RR, SR หรือ RS",defaultPrefix);if(prefix===null)return;
      const cleanPrefix=String(prefix||"R").trim().toUpperCase();if(!["S","R","SS","RR","SR","RS"].includes(cleanPrefix)){showNotice("warning","กรุณาเลือกตัวอักษรหน้าประตูให้ถูกต้อง");return}
      const number=window.prompt("กรอกหมายเลขประตู",defaultNumber);if(number===null)return;const cleanNumber=String(number||"").replace(/\D/g,"").slice(0,3);
      if(!cleanNumber){if(requiresDoor){showNotice("warning","กรุณากรอกหมายเลขประตู");return}}else{doorCode=`${cleanPrefix}${cleanNumber}`;if(!availableDoors.includes(doorCode)){showNotice("warning",`ประตู ${doorCode} ยังไม่ได้เปิดใช้งาน`);return}}
    }
    if(!window.confirm(`ยืนยันเริ่มตรวจรับ ${vehicle.appointment_no||autoId}`))return;
  }
  await runReceivingAction(vehicle,"start",doorCode);
}

async function completeReceiving(vehicle){
  const autoId=String(vehicle.auto_id);if(receivingState.busyIds.has(autoId))return;
  if(window.Swal){const result=await Swal.fire({title:"ยืนยันรับสินค้าเสร็จ",html:`${vehicleDetailsHtml(vehicle,autoId)}<div class="completion-time"><span>เริ่มตรวจรับ</span><b>${formatDate(vehicle.receiving_started_at)}</b><span>ใช้เวลารวม</span><b>${formatDuration(unixNow()-Number(vehicle.receiving_started_at||unixNow()))}</b></div>`,icon:"question",showCancelButton:true,confirmButtonText:"รับสินค้าเสร็จ",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:{...swalClasses(),confirmButton:"wfv-swal-confirm wfv-swal-complete"},buttonsStyling:false,width:440});if(!result.isConfirmed)return}else if(!window.confirm(`ยืนยันรับสินค้าเสร็จ ${vehicle.appointment_no||autoId}`))return;
  await runReceivingAction(vehicle,"complete",null);
}

async function runReceivingAction(vehicle,action,doorCode){
  const autoId=String(vehicle.auto_id),path=action==="start"?"/api/workflow/receiving-start":"/api/workflow/receiving-complete";receivingState.busyIds.add(autoId);if(state.view==="operations")renderOperations();
  const idempotencyKey=createIdempotencyKey();
  try{
    if(window.Swal)Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});
    const result=await api(path,{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId,doorCode,idempotencyKey}});
    mergeVehicleUpdate(result.vehicle);receivingState.busyIds.delete(autoId);if(state.view==="operations")renderOperations();else if(state.view==="datatable")await loadDatatable(true);playFeedbackSound(result.duplicate?"duplicate":"success");
    const title=action==="start"?"เริ่มตรวจรับแล้ว":"รับสินค้าเสร็จแล้ว",message=action==="complete"?"นำงานออกจากหน้าตรวจรับเรียบร้อย":result.message;
    if(window.Swal)await Swal.fire({icon:result.duplicate?"warning":"success",title,html:`<p class="swal-message">${escapeHtml(message)}</p>`,timer:2200,timerProgressBar:true,showConfirmButton:false,customClass:swalClasses(),width:360});else showKioskMessage(message,true);
  }catch(error){receivingState.busyIds.delete(autoId);if(error.data?.vehicle)mergeVehicleUpdate(error.data.vehicle);if(state.view==="operations")renderOperations();playFeedbackSound("error");await showNotice("error",error.message)}
}

function mergeVehicleUpdate(vehicle){
  if(!vehicle)return;
  const autoId=vehicle.autoId??vehicle.auto_id,index=state.vehicles.findIndex(item=>String(item.auto_id)===String(autoId));if(index<0)return;
  const current=state.vehicles[index],pick=(camel,snake)=>Object.prototype.hasOwnProperty.call(vehicle,camel)?vehicle[camel]:Object.prototype.hasOwnProperty.call(vehicle,snake)?vehicle[snake]:current[snake];
  state.vehicles[index]={...current,auto_id:autoId,appointment_no:pick("appointmentNo","appointment_no"),company_name:pick("companyName","company_name"),driver_name:pick("driverName","driver_name"),vehicle_plate:pick("vehiclePlate","vehicle_plate"),province:pick("province","province"),vehicle_type:pick("vehicleType","vehicle_type"),current_status:pick("currentStatus","current_status"),door_code:pick("doorCode","door_code"),gate_in_at:pick("gateInAt","gate_in_at"),document_submitted_at:pick("documentSubmittedAt","document_submitted_at"),document_checked_at:pick("documentCheckedAt","document_checked_at"),receiving_started_at:pick("receivingStartedAt","receiving_started_at"),receiving_completed_at:pick("receivingCompletedAt","receiving_completed_at"),document_returned_at:pick("documentReturnedAt","document_returned_at"),use_document_check:pick("useDocumentCheck","use_document_check"),use_door:pick("useDoor","use_door"),require_door:pick("requireDoor","require_door"),queue_call_id:pick("queueCallId","queue_call_id"),queue_call_type:pick("queueCallType","queue_call_type"),queue_reason_code:pick("queueReasonCode","queue_reason_code"),queue_called_at:pick("queueCalledAt","queue_called_at"),queue_call_count:pick("queueCallCount","queue_call_count"),queue_previous_door_code:pick("queuePreviousDoorCode","queue_previous_door_code"),rejected_at:pick("rejectedAt","rejected_at"),rejection_reason:pick("rejectionReason","rejection_reason"),rejection_detail:pick("rejectionDetail","rejection_detail"),rejection_supervisor:pick("rejectionSupervisor","rejection_supervisor"),rejection_supervisor_position:pick("rejectionSupervisorPosition","rejection_supervisor_position"),rejection_require_document_return:pick("rejectionRequireDocumentReturn","rejection_require_document_return")};
}
function parseDoorCode(value){const match=String(value||"").toUpperCase().match(/^(SS|RR|SR|RS|S|R)(\d{1,3})$/);return{prefix:match?.[1]||"R",number:match?.[2]||""}}

function renderInbound() {
  const counts=statusCounts(),documentCheckOn=state.documentCheckEnabled||Number(counts.WAITING_DOCUMENT_CHECK||0)>0;
  if(!documentCheckOn&&inboundListState.filter==="WAITING_DOCUMENT_CHECK")inboundListState.filter="ALL";
  const kioskLogout=state.user.accessRights==="INBOUND"?`<button id="kioskLogout" class="quiet-button">ออกจากระบบ</button>`:"";
  const syncLabel=state.online?"● พร้อมใช้งาน":"● รอเชื่อมต่อ",syncClass=state.online?"is-online":"is-offline";
  const checkMetric=documentCheckOn?inboundMetric("metricDocumentCheck","รอตรวจเอกสาร",counts.WAITING_DOCUMENT_CHECK,"metric-amber","doc-pen"):"";
  const rejectedReturnCount=Number(counts.REJECTED_WAITING_DOCUMENT_RETURN||0),mainInboundCount=state.vehicles.filter(v=>!String(v.current_status||"").startsWith("REJECTED_")).length;
  const tabs=[
    ["ALL","ทั้งหมด",mainInboundCount],
    ["WAITING_DOCUMENT_SUBMISSION","รอยื่นเอกสาร",counts.WAITING_DOCUMENT_SUBMISSION||0],
    ...(documentCheckOn?[["WAITING_DOCUMENT_CHECK","รอตรวจเอกสาร",counts.WAITING_DOCUMENT_CHECK||0]]:[]),
    ["READY_FOR_RECEIVING","พร้อมตรวจรับ",counts.READY_FOR_RECEIVING||0],
    ...(rejectedReturnCount>0?[["REJECTED_WAITING_DOCUMENT_RETURN","ปฏิเสธ/คืนเอกสาร",rejectedReturnCount]]:[])
  ];
  $("pageContent").innerHTML = `<section class="inbound-workspace inbound-workspace-r88"><aside class="inbound-scan-station${state.trackingEnabled?"":" tracking-disabled"}"><div class="scanner compact-scanner"><div class="scan-panel-head"><h2>สแกน QR Code</h2></div><div id="scanFrame" class="scan-frame"><video id="qrVideo" class="qr-video" playsinline muted hidden></video><canvas id="qrCanvas" hidden></canvas><div id="scanPlaceholder" class="scan-placeholder"><span class="scan-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span></div><div id="scanBeam" class="scan-beam" hidden></div></div><div class="scan-actions"><button id="startCamera" class="primary">เปิดกล้องสแกน</button><button id="stopCamera" class="outline-button" hidden>ปิดกล้อง</button></div></div><div class="scan-input-block compact-input-block"><h2>บันทึกด้วยตนเอง</h2><div class="auto-input"><input id="autoSearch" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="done" placeholder="กรอก Auto ID / เลขนัดหมาย"><button id="autoButton" class="primary">บันทึก</button></div></div>${state.trackingEnabled?`<section id="inboundDriverQr" class="inbound-driver-qr" aria-live="polite"><header><div><small>สำหรับคนขับรถ</small><h2>ติดตามสถานะรถ</h2></div><span id="driverQrTimer" class="driver-qr-timer" hidden></span></header><div id="driverQrBody" class="driver-qr-body"><div class="driver-qr-idle"><b>ยังไม่มี QR ติดตาม</b><span>สแกน Auto ID เพื่อแสดง QR</span></div></div></section>`:""}</aside><section class="inbound-main-stack"><section class="inbound-controlbar"><div class="inbound-kiosk-title inbound-kiosk-title-merged"><span class="inbound-mini-logo" aria-hidden="true"><span class="spectrum-mark"><i></i><i></i><i></i><i></i><i></i><i></i></span></span><div class="inbound-title-copy"><small>แผนก Inbound</small><b>ยื่นเอกสารและตรวจเอกสาร</b><span class="inbound-title-meta"><time id="inboundHeaderClock">${formatDate(unixNow())}</time></span></div></div><div class="inbound-page-actions inbound-page-actions-merged"><span id="inboundSyncStatus" class="inbound-sync-status ${syncClass}">${syncLabel}</span><button id="fullscreenButton" class="quiet-button">เต็มหน้าจอ</button>${kioskLogout}</div></section><section class="inbound-metrics inbound-metrics-top inbound-metrics-r88 ${documentCheckOn?"is-four":"is-three"}" data-metric-count="${documentCheckOn?4:3}">${inboundMetric("metricWaiting","รอยื่นเอกสาร",counts.WAITING_DOCUMENT_SUBMISSION,"metric-orange","doc-pen")}${checkMetric}${inboundMetric("metricReady","พร้อมตรวจรับ",counts.READY_FOR_RECEIVING,"metric-green","check-circle")}${inboundMetric("metricTotal","รถในพื้นที่",state.vehicles.length,"metric-magenta","truck")}</section><section class="list-card inbound-list-card inbound-list-r88"><header class="inbound-list-head-r88"><div><h2>${documentCheckOn?"รายการ Inbound":"รถที่ยังอยู่ในพื้นที่"}</h2><span id="inboundListCount"></span></div><nav class="inbound-stage-tabs" data-tab-count="${tabs.length}" style="--inbound-tab-columns:${tabs.length}" aria-label="กรองสถานะ">${tabs.map(([key,label,count])=>`<button type="button" data-inbound-filter="${key}" data-stage-count="${key}" class="${inboundListState.filter===key?"active":""}"><span>${label}</span><b>${Number(count)||0}</b></button>`).join("")}</nav></header><div id="inboundTableHead" class="inbound-table-head" aria-hidden="true"></div><div id="inboundRows"></div></section></section></section>`;
  renderInboundRows();
  $("autoSearch").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();if(submitState.busy)return;playFeedbackSound("scan");submitManualAutoId("scanner")}});
  $("autoButton").addEventListener("click",()=>submitManualAutoId("manual"));
  $("startCamera").addEventListener("click",startCamera);$("stopCamera").addEventListener("click",stopCamera);$("fullscreenButton").addEventListener("click",toggleFullscreen);$("kioskLogout")?.addEventListener("click",logout);
  document.querySelectorAll("[data-inbound-filter]").forEach(button=>button.addEventListener("click",()=>{inboundListState.filter=button.dataset.inboundFilter;document.querySelectorAll("[data-inbound-filter]").forEach(tab=>tab.classList.toggle("active",tab.dataset.inboundFilter===inboundListState.filter));renderInboundRows();}));
  $("inboundRows").addEventListener("click",event=>{const action=event.target.closest("[data-document-check]");if(action){event.stopPropagation();const vehicle=state.vehicles.find(item=>String(item.auto_id)===String(action.dataset.documentCheck));if(vehicle)confirmDocumentChecked(vehicle);return}const rejectedReturn=event.target.closest("[data-rejected-return]");if(rejectedReturn){event.stopPropagation();const vehicle=state.vehicles.find(item=>String(item.auto_id)===String(rejectedReturn.dataset.rejectedReturn));if(vehicle)confirmRejectedDocumentReturn(vehicle);return}const row=event.target.closest("[data-auto-id]");if(row)showInboundVehicleDetails(row.dataset.autoId)});
  $("inboundRows").addEventListener("keydown",event=>{if(event.key!=="Enter"&&event.key!==" ")return;const row=event.target.closest("[data-auto-id]");if(row&&!event.target.closest("button")){event.preventDefault();showInboundVehicleDetails(row.dataset.autoId)}});
  updateFullscreenButton();window.setTimeout(()=>$('autoSearch')?.focus({preventScroll:true}),50);window.setTimeout(()=>checkInboundLiveUpdates(true),100);
}

function inboundFilteredItems(){const key=inboundListState.filter||"ALL";return key==="ALL"?state.vehicles.filter(v=>!String(v.current_status||"").startsWith("REJECTED_")):state.vehicles.filter(v=>v.current_status===key)}
function renderInboundRows() {
  const items=inboundFilteredItems(),isCheck=inboundListState.filter==="WAITING_DOCUMENT_CHECK",isRejectedReturn=inboundListState.filter==="REJECTED_WAITING_DOCUMENT_RETURN";
  const head=$("inboundTableHead");if(head){head.classList.toggle("document-check-head",isCheck);head.classList.toggle("rejected-return-head",isRejectedReturn);head.innerHTML=isCheck?`<span>เลขนัดหมาย</span><span>บริษัท / คนขับ</span><span>Gate In</span><span>ยื่นเอกสาร</span><span>เวลาตรวจเอกสาร</span><span>ระดับ</span><span>ดำเนินการ</span>`:isRejectedReturn?`<span>เลขนัดหมาย</span><span>บริษัท</span><span>ทะเบียนรถ</span><span>เหตุผล</span><span>ปฏิเสธเมื่อ</span><span>ผู้รับทราบ</span><span>ดำเนินการ</span>`:`<span>เลขนัดหมาย</span><span>บริษัท</span><span>ทะเบียนรถ</span><span>ประตู</span><span>สถานะ</span><span>ระดับเตือน / เวลาค้าง</span>`;}
  const rows=$("inboundRows");if(!rows)return;
  rows.classList.toggle("document-check-list",isCheck);rows.classList.toggle("rejected-return-list",isRejectedReturn);
  rows.innerHTML=items.length?items.map(v=>{
    if(isCheck){const reviewStart=Number(v.document_submitted_at||v.gate_in_at||0);return `<div class="list-row document-check-row ${alertToneClass(v.alert_level)}" data-auto-id="${escapeHtml(v.auto_id)}" role="button" tabindex="0"><b class="inbound-cell inbound-appointment">${escapeHtml(v.appointment_no||v.auto_id)}</b><span class="inbound-cell document-check-party"><b>${escapeHtml(v.company_name||"ไม่ระบุ")}</b><small>${escapeHtml(v.driver_name||joinText(v.vehicle_plate,v.province)||"ไม่ระบุคนขับ")}</small>${appointmentInline(v,"inbound")}</span><span class="inbound-cell"><b>${formatDate(v.gate_in_at)}</b><small>${formatDuration(Math.max(0,Number(v.document_submitted_at||0)-Number(v.gate_in_at||0)))}</small></span><span class="inbound-cell"><b>${formatDate(v.document_submitted_at)}</b><small>เริ่มตรวจเวลา</small></span><span class="inbound-cell document-review-time"><b data-duration-start="${reviewStart}">${formatDuration(v.stage_elapsed_seconds)}</b><small>ตั้งแต่ยื่นเอกสาร</small></span><span class="row-alert-wrap"><strong class="row-alert-level">${alertLevelLabel(v.alert_level)}</strong><small>${escapeHtml(v.alert_stage_code==="DOCUMENT_REVIEW"?"ตรวจเอกสาร":"เวลารวม")}</small></span><button class="document-check-button" type="button" data-document-check="${escapeHtml(v.auto_id)}">ตรวจเอกสารเสร็จ</button></div>`}
    if(isRejectedReturn){return `<div class="list-row rejected-return-row" data-auto-id="${escapeHtml(v.auto_id)}" role="button" tabindex="0"><b class="inbound-cell inbound-appointment">${escapeHtml(v.appointment_no||v.auto_id)}</b><span class="inbound-cell"><b>${escapeHtml(v.company_name||"ไม่ระบุ")}</b><small>${escapeHtml(v.driver_name||"ไม่ระบุคนขับ")}</small></span><span class="inbound-cell"><b>${escapeHtml(joinText(v.vehicle_plate,v.province)||"-")}</b></span><span class="inbound-cell rejected-reason"><b>${escapeHtml(v.rejection_reason||"ไม่ระบุ")}</b>${v.rejection_detail?`<small>${escapeHtml(v.rejection_detail)}</small>`:""}</span><span class="inbound-cell"><b>${formatDate(v.rejected_at)}</b><small>ปฏิเสธรับสินค้า</small></span><span class="inbound-cell"><b>${escapeHtml(v.rejection_supervisor||"-")}</b><small>${escapeHtml(v.rejection_supervisor_position||"")}</small></span><button class="rejected-return-button" type="button" data-rejected-return="${escapeHtml(v.auto_id)}">คืนเอกสารแล้ว</button></div>`}

    return `<div class="list-row status-row ${statusTone(v.current_status)} ${alertToneClass(v.alert_level)}" data-auto-id="${escapeHtml(v.auto_id)}" role="button" tabindex="0" aria-label="เปิดรายละเอียด ${escapeHtml(v.appointment_no||v.auto_id)}"><b class="inbound-cell inbound-appointment" data-label="เลขนัดหมาย">${escapeHtml(v.appointment_no || v.auto_id)}</b><span class="inbound-cell inbound-company" data-label="บริษัท">${escapeHtml(v.company_name || "ไม่ระบุ")}${appointmentInline(v,"inbound")}</span><span class="inbound-cell inbound-plate" data-label="ทะเบียนรถ">${escapeHtml(joinText(v.vehicle_plate,v.province))}</span><span class="inbound-cell inbound-door" data-label="ประตู">${escapeHtml(v.door_code || "-")}</span><span class="row-status-wrap" data-label="สถานะ"><span class="badge status-badge">${statusLabel(v.current_status)}</span></span><span class="row-alert-wrap" data-label="ระดับเตือน / เวลาค้าง"><strong class="row-alert-level">${alertLevelLabel(v.alert_level)}</strong><small><b data-duration-start="${Number(v.alert_started_at||v.gate_in_at||0)}">${formatDuration(v.stage_elapsed_seconds)}</b></small></span></div>`
  }).join(""):`<div class="empty-state"><b>${isCheck?"ไม่มีเอกสารรอตรวจ":isRejectedReturn?"ไม่มีรายการปฏิเสธรอคืนเอกสาร":"ไม่พบข้อมูลในสถานะนี้"}</b><span>${isCheck?"เมื่อมีงานใหม่ รายการจะขึ้นที่นี่":isRejectedReturn?"รายการที่ต้องคืนเอกสารจะแสดงที่นี่":"เลือกสถานะอื่นหรือรอข้อมูลใหม่"}</span></div>`;
  if($("inboundListCount"))$("inboundListCount").textContent=`${items.length} รายการ`;
}
async function confirmRejectedDocumentReturn(vehicle){
  if(!vehicle||submitState.busy)return;
  let confirmed=true;
  if(window.Swal){const result=await Swal.fire({title:"ยืนยันคืนเอกสารแล้ว",html:`<div class="rejected-return-confirm"><small>เลขนัดหมาย</small><b>${escapeHtml(vehicle.appointment_no||vehicle.auto_id)}</b><span>${escapeHtml(vehicle.company_name||"ไม่ระบุบริษัท")}</span><div><small>เหตุผลปฏิเสธ</small><strong>${escapeHtml(vehicle.rejection_reason||"ไม่ระบุ")}</strong></div></div>`,showCancelButton:true,confirmButtonText:"ยืนยันคืนเอกสาร",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,buttonsStyling:false,customClass:{...swalClasses(),popup:"wfv-swal rejected-return-swal"},width:420});confirmed=result.isConfirmed}else confirmed=window.confirm(`ยืนยันคืนเอกสาร ${vehicle.appointment_no||vehicle.auto_id}`);
  if(!confirmed)return;
  submitState.busy=true;const idempotencyKey=createIdempotencyKey();
  try{if(window.Swal)Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});const result=await api("/api/workflow/inbound-return",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:vehicle.auto_id,idempotencyKey,source:"rejected-return"}});mergeVehicleUpdate(result.vehicle);playFeedbackSound(result.duplicate?"duplicate":"success");if(state.view==="datatable")await loadDatatable(true);else await refreshInboundKioskData();if(window.Swal)await Swal.fire({icon:"success",title:"คืนเอกสารแล้ว",text:"รายการย้ายไปรอออกจากพื้นที่",timer:1500,showConfirmButton:false,customClass:swalClasses(),width:360})}
  catch(error){if(error.data?.vehicle)mergeVehicleUpdate(error.data.vehicle);playFeedbackSound("error");await showNotice("error",error.message||"บันทึกคืนเอกสารไม่สำเร็จ")}
  finally{submitState.busy=false}
}

async function confirmDocumentChecked(vehicle){
  if(!vehicle||submitState.busy)return;
  const submitted=Number(vehicle.document_submitted_at||0),gateIn=Number(vehicle.gate_in_at||0),reviewSeconds=Math.max(0,unixNow()-(submitted||unixNow()));
  let confirmed=true;
  if(window.Swal){const result=await Swal.fire({title:"ยืนยันตรวจเอกสารเสร็จ",html:`<div class="document-check-confirm clean-document-check-dialog"><div class="document-check-confirm-head"><small>เลขนัดหมาย</small><b>${escapeHtml(vehicle.appointment_no||vehicle.auto_id)}</b><span>${escapeHtml(vehicle.company_name||"ไม่ระบุบริษัท")}</span></div><div class="document-check-confirm-grid"><div><small>Gate In</small><b>${formatDate(gateIn)}</b></div><div><small>ยื่นเอกสาร</small><b>${formatDate(submitted)}</b></div><div class="is-primary"><small>ใช้เวลาตรวจแล้ว</small><b>${formatDuration(reviewSeconds)}</b></div></div><div class="document-check-confirm-note">ยืนยันแล้วรถจะย้ายไปสถานะ <strong>พร้อมตรวจรับ</strong></div></div>`,showCancelButton:true,confirmButtonText:"ยืนยันเสร็จ",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:{...swalClasses(),popup:"wfv-swal document-check-swal",confirmButton:"wfv-swal-confirm document-check-confirm-button",cancelButton:"wfv-swal-cancel"},buttonsStyling:false,width:460});confirmed=result.isConfirmed}else confirmed=window.confirm(`ยืนยันตรวจเอกสารเสร็จ ${vehicle.appointment_no||vehicle.auto_id}`);
  if(!confirmed)return;
  submitState.busy=true;const idempotencyKey=createIdempotencyKey();
  try{if(window.Swal)Swal.fire({title:"กำลังบันทึก",text:"กำลังย้ายรายการไปพร้อมตรวจรับ",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:{...swalClasses(),popup:"wfv-swal document-check-swal"},width:360});const result=await api("/api/workflow/document-check",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:vehicle.auto_id,idempotencyKey,source:"manual"}});mergeVehicleUpdate(result.vehicle);playFeedbackSound(result.duplicate?"duplicate":"success");if(state.view==="datatable")await loadDatatable(true);else await refreshInboundKioskData();if(window.Swal)await Swal.fire({icon:"success",title:"ตรวจเอกสารเสร็จแล้ว",text:"ย้ายรายการไปพร้อมตรวจรับเรียบร้อย",timer:1600,showConfirmButton:false,customClass:{...swalClasses(),popup:"wfv-swal document-check-swal"},width:360})}
  catch(error){if(error.data?.vehicle)mergeVehicleUpdate(error.data.vehicle);playFeedbackSound("error");await showNotice("error",error.message||"บันทึกตรวจเอกสารไม่สำเร็จ")}
  finally{submitState.busy=false}
}

function inboundMetric(id,label,value,tone,icon){return `<article class="inbound-metric ${tone}"><span class="inbound-metric-icon">${metricIcon(icon)}</span><div class="inbound-metric-copy"><small>${label}</small><b id="${id}">${Number(value)||0}</b></div></article>`}
function metricIcon(type){const icons={
  "doc-pen":`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 3.5V8h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8.5 10.2h5.5M8.5 13.2h4.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="m13.7 16.6 3.45-3.45a1.15 1.15 0 0 1 1.63 1.63l-3.45 3.45-2.1.48.47-2.11Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  "check-circle":`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m8.5 12.3 2.3 2.3 4.8-5.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "rf-device":`<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.8" width="10" height="8.5" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9.4 15h5.2M12 11.3v7.4M9 21l.7-3.2h4.6L15 21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 5.2h8M9.8 7.6h4.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  "doc-return":`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h6l4 4V19a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M13 3.5V8h4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m9 14 2.2-2.2L9 9.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.3 11.8h4.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><path d="M15.6 15.7h3.2M17.2 14.1v3.2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  "exit-arrow":`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5v13h13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 15 18.5 5.5M13.3 5.5h5.2v5.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "truck":`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h10v8h-10zM13.5 10h3l2 2.4v3.1h-5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="8" cy="17.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="17.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`};
  return icons[type]||icons["truck"];
}

function submitManualAutoId(source="manual"){const input=$("autoSearch"),autoId=normalizeAutoId(input?.value);if(input)input.value="";renderInboundRows(state.vehicles);if(!autoId){playFeedbackSound("error");showNotice("warning","กรุณากรอก Auto ID");input?.focus();return}if(source!=="scanner")playFeedbackSound("scan");confirmInboundSubmit(autoId,source)}

async function startCamera(){
  if(scannerState.active)return;
  unlockAudio();
  if(!navigator.mediaDevices?.getUserMedia){showNotice("info","อุปกรณ์นี้ยังไม่พร้อมใช้งานกล้อง กรุณาใช้เครื่องสแกนหรือกรอก Auto ID");return}
  try{
    scannerState.detector=null;
    if("BarcodeDetector" in window){
      const formats=typeof BarcodeDetector.getSupportedFormats==="function"?await BarcodeDetector.getSupportedFormats():["qr_code"];
      if(formats.includes("qr_code"))scannerState.detector=new BarcodeDetector({formats:["qr_code"]});
    }
    if(!scannerState.detector&&typeof window.jsQR!=="function"){showNotice("info","อุปกรณ์นี้ยังไม่พร้อมอ่าน QR Code กรุณาใช้เครื่องสแกนหรือกรอก Auto ID");return}
    scannerState.stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:"environment"},width:{ideal:1920},height:{ideal:1080}}});
    const track=scannerState.stream.getVideoTracks()[0];
    try{const capabilities=track?.getCapabilities?.();if(capabilities?.focusMode?.includes("continuous"))await track.applyConstraints({advanced:[{focusMode:"continuous"}]})}catch{}
    const video=$("qrVideo"),canvas=$("qrCanvas");if(!video||!canvas){stopCamera();return}
    scannerState.canvas=canvas;scannerState.context=canvas.getContext("2d",{willReadFrequently:true});scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;
    video.srcObject=scannerState.stream;video.hidden=false;$("scanPlaceholder").hidden=true;$("scanBeam").hidden=false;$("startCamera").hidden=true;$("stopCamera").hidden=false;$("scanFrame").classList.add("camera-on");await video.play();scannerState.active=true;scannerState.reading=false;scanCameraFrame();
  }catch(error){stopCamera();const denied=error?.name==="NotAllowedError"||error?.name==="PermissionDeniedError";showNotice("error",denied?"ไม่ได้รับอนุญาตให้เปิดกล้อง กรุณาอนุญาตกล้องแล้วลองใหม่":"เปิดกล้องไม่สำเร็จ กรุณากรอก Auto ID")}
}

async function scanCameraFrame(){
  if(!scannerState.active||scannerState.reading)return;
  if(uiState.detailsOpen){scannerState.timer=window.setTimeout(scanCameraFrame,250);return}
  const video=$("qrVideo");if(!video)return;
  try{
    let rawValue="";
    if(scannerState.detector){const codes=await scannerState.detector.detect(video);rawValue=String(codes?.[0]?.rawValue||"")}
    if(!rawValue&&typeof window.jsQR==="function"&&video.readyState>=2&&scannerState.context){
      const width=video.videoWidth,height=video.videoHeight;
      if(width&&height){scannerState.canvas.width=width;scannerState.canvas.height=height;scannerState.context.drawImage(video,0,0,width,height);const pixels=scannerState.context.getImageData(0,0,width,height);rawValue=window.jsQR(pixels.data,width,height,{inversionAttempts:"attemptBoth"})?.data||""}
    }
    if(uiState.detailsOpen){scannerState.timer=window.setTimeout(scanCameraFrame,250);return}
    const value=normalizeAutoId(rawValue),now=Date.now();
    if(value){
      if(value===scannerState.lastValue&&now-scannerState.lastSeenAt<1500)scannerState.repeatCount+=1;else scannerState.repeatCount=1;
      scannerState.lastValue=value;scannerState.lastSeenAt=now;
      if(scannerState.repeatCount>=2){
        scannerState.reading=true;playFeedbackSound("scan");clearInboundInput();
        try{await confirmInboundSubmit(value,"camera")}
        finally{scannerState.reading=false;scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;if(scannerState.active)scannerState.timer=window.setTimeout(scanCameraFrame,300)}
        return;
      }
    }
  }catch{}
  scannerState.timer=window.setTimeout(scanCameraFrame,120);
}

function stopCamera(){
  scannerState.active=false;scannerState.reading=false;if(scannerState.timer)window.clearTimeout(scannerState.timer);scannerState.timer=0;
  if(scannerState.stream)scannerState.stream.getTracks().forEach(track=>track.stop());scannerState.stream=null;scannerState.detector=null;scannerState.canvas=null;scannerState.context=null;scannerState.lastValue="";scannerState.lastSeenAt=0;scannerState.repeatCount=0;
  const video=$("qrVideo");if(video){video.pause();video.srcObject=null;video.hidden=true}
  if($("scanPlaceholder"))$("scanPlaceholder").hidden=false;if($("scanBeam"))$("scanBeam").hidden=true;if($("startCamera"))$("startCamera").hidden=false;if($("stopCamera"))$("stopCamera").hidden=true;if($("scanFrame"))$("scanFrame").classList.remove("camera-on");
}

async function confirmInboundSubmit(autoId,source){
  const rawValue=normalizeAutoId(autoId);if(!rawValue||submitState.busy)return;
  const vehicle=state.vehicles.find(item=>String(item.auto_id).toLowerCase()===rawValue.toLowerCase()),value=vehicle?String(vehicle.auto_id):rawValue,automatic=["scanner","camera"].includes(source);
  const returning=["WAITING_DOCUMENT_RETURN","REJECTED_WAITING_DOCUMENT_RETURN"].includes(vehicle?.current_status),confirmationTitle=returning?"ยืนยันรับเอกสารคืน":"ยืนยันยื่นเอกสาร";
  if(!window.Swal){
    if(!automatic&&!window.confirm(`${confirmationTitle} Auto ID: ${value}`))return;
    submitState.busy=true;
    try{const idempotencyKey=createIdempotencyKey(),result=await api("/api/workflow/inbound-scan",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});mergeVehicleUpdate(result.vehicle);playFeedbackSound(result.duplicate?"duplicate":"success");showInboundTracking(result.tracking,result.vehicle||vehicle,result.duplicate?20:15);showKioskMessage(result.message||"บันทึกเรียบร้อย",true);await refreshInboundKioskData().catch(()=>restoreInboundMainDisplay())}
    catch(error){playFeedbackSound("error");showKioskMessage(error.message,false)}
    finally{submitState.busy=false;restoreInboundMainDisplay()}
    return;
  }
  const details=vehicleDetailsHtml(vehicle,value);
  submitState.busy=true;
  if(!automatic){
    const confirmation=await Swal.fire({title:confirmationTitle,html:details,icon:"question",showCancelButton:true,confirmButtonText:"ยืนยันบันทึก",cancelButtonText:"ยกเลิก",reverseButtons:true,focusCancel:true,customClass:swalClasses(),buttonsStyling:false,width:420});
    if(!confirmation.isConfirmed){submitState.busy=false;restoreInboundMainDisplay();return}
    Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});
  }
  const idempotencyKey=createIdempotencyKey();
  try{
    const result=await api("/api/workflow/inbound-scan",{method:"POST",headers:{"x-idempotency-key":idempotencyKey},body:{autoId:value,idempotencyKey,source}});
    const duplicate=Boolean(result.duplicate);playFeedbackSound(duplicate?"duplicate":"success");mergeVehicleUpdate(result.vehicle);
    showInboundTracking(result.tracking,result.vehicle||vehicle,duplicate?20:15);
    if(automatic){
      showKioskMessage(result.message||"บันทึกเรียบร้อย",true);
    }else{
      const title=result.action==="DOCUMENT_RETURNED"?(duplicate?"รับเอกสารคืนแล้ว":"บันทึกรับเอกสารคืนแล้ว"):result.action==="DOCUMENT_SUBMITTED"?(duplicate?"ยื่นเอกสารแล้ว":"บันทึกยื่นเอกสารแล้ว"):"ตรวจสอบสถานะแล้ว";
      await Swal.fire({icon:duplicate?"warning":"success",title,html:`<p class="swal-message${duplicate?" duplicate-message":""}">${escapeHtml(result.message||"บันทึกเรียบร้อย")}</p>${vehicleDetailsHtml(result.vehicle||vehicle,value)}`,timer:duplicate?3200:1800,timerProgressBar:true,showConfirmButton:false,customClass:swalClasses(),width:420});
    }
    await refreshInboundKioskData().catch(()=>restoreInboundMainDisplay());
  }catch(error){playFeedbackSound("error");const errorVehicle=error.data?.vehicle||vehicle;if(automatic)showKioskMessage(error.message,false);else await Swal.fire({icon:"error",title:"บันทึกไม่สำเร็จ",html:`<p class="swal-message">${escapeHtml(error.message)}</p>${vehicleDetailsHtml(errorVehicle,value)}`,confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:420})}
  finally{submitState.busy=false;restoreInboundMainDisplay()}
}

const inboundTrackingQrCache=new Map();
function trackingQrSvg(url){if(inboundTrackingQrCache.has(url))return inboundTrackingQrCache.get(url);const svg=window.WVQRCode?.toSvg?window.WVQRCode.toSvg(url,{margin:4}):`<div class="driver-qr-fallback">QR ไม่พร้อมใช้งาน</div>`;inboundTrackingQrCache.set(url,svg);if(inboundTrackingQrCache.size>24)inboundTrackingQrCache.delete(inboundTrackingQrCache.keys().next().value);return svg}
function trackingPageUrl(token){return new URL(`./track.html?t=${encodeURIComponent(token)}&v=20260811-r91`,location.href).href}
function showInboundTracking(tracking,vehicle,seconds){
  if(!state.trackingEnabled)return;
  const panel=$("inboundDriverQr"),body=$("driverQrBody");if(!panel||!body)return;
  if(inboundTrackPanel.timer)window.clearInterval(inboundTrackPanel.timer);
  if(!tracking?.token){renderInboundTrackingUnavailable(vehicle);return}
  const duration=Math.max(8,Math.min(60,Number(tracking.displaySeconds||seconds||15))),url=trackingPageUrl(tracking.token),appointment=vehicle?.appointmentNo??vehicle?.appointment_no??vehicle?.autoId??vehicle?.auto_id??"-",company=vehicle?.companyName??vehicle?.company_name??"ไม่ระบุบริษัท",plate=[vehicle?.vehiclePlate??vehicle?.vehicle_plate,vehicle?.province].filter(Boolean).join(" ")||"ไม่ระบุทะเบียน";
  inboundTrackPanel.active=true;inboundTrackPanel.until=Date.now()+duration*1000;panel.classList.add("is-active");
  const qr=trackingQrSvg(url);
  body.innerHTML=`<div class="driver-qr-code">${qr}</div><div class="driver-qr-caption"><div class="driver-qr-meta"><span><small>หมายเลขนัดหมาย</small><b>${escapeHtml(appointment)}</b></span><span><small>บริษัท</small><strong>${escapeHtml(company)}</strong></span><span><small>ทะเบียนรถ</small><strong>${escapeHtml(plate)}</strong></span></div><p>สแกนด้วยโทรศัพท์เพื่อติดตามสถานะรถ</p></div>`;
  const tick=()=>{const remain=Math.max(0,Math.ceil((inboundTrackPanel.until-Date.now())/1000)),timer=$("driverQrTimer");if(timer){timer.hidden=false;timer.textContent=`${remain} วินาที`}if(remain<=0){window.clearInterval(inboundTrackPanel.timer);inboundTrackPanel.timer=0;expireInboundTrackingPanel()}};tick();inboundTrackPanel.timer=window.setInterval(tick,500);
}
function expireInboundTrackingPanel(){const body=$("driverQrBody"),timer=$("driverQrTimer"),panel=$("inboundDriverQr");inboundTrackPanel.active=false;panel?.classList.remove("is-active");if(timer)timer.hidden=true;if(body)body.innerHTML=`<div class="driver-qr-idle driver-qr-expired"><b>QR บนหน้าจอหมดเวลาแล้ว</b><span>สแกน Auto ID เดิมอีกครั้งเพื่อแสดง QR ใหม่</span></div>`}
function renderInboundTrackingUnavailable(vehicle){const body=$("driverQrBody"),timer=$("driverQrTimer");if(timer)timer.hidden=true;if(body)body.innerHTML=`<div class="driver-qr-idle driver-qr-error"><b>ยังไม่สามารถแสดง QR ติดตามได้</b><span>${escapeHtml(vehicle?.appointmentNo||vehicle?.appointment_no||"")} กรุณาแจ้งผู้ดูแลระบบ</span></div>`}

function vehicleDetailsHtml(vehicle,autoId){
  const read=(snake,camel)=>vehicle?.[snake]??vehicle?.[camel]??"";
  const driver=read("driver_name","driverName")||joinText(read("driver_title","driverTitle"),read("driver_first_name","driverFirstName"),read("driver_last_name","driverLastName"));
  return `<div class="confirm-grid"><span>Auto ID</span><b>${escapeHtml(autoId||read("auto_id","autoId")||"ไม่ระบุ")}</b><span>เลขนัดหมาย</span><b>${escapeHtml(read("appointment_no","appointmentNo")||"ไม่พบข้อมูล")}</b><span>บริษัท</span><b>${escapeHtml(read("company_name","companyName")||"ไม่พบข้อมูล")}</b><span>ชื่อคนขับรถ</span><b>${escapeHtml(driver||"ไม่พบข้อมูล")}</b><span>ทะเบียนรถ</span><b>${escapeHtml(joinText(read("vehicle_plate","vehiclePlate"),read("province","province")))}</b></div>`;
}

async function showInboundVehicleDetails(autoId){
  if(uiState.detailsOpen||submitState.busy)return;
  const vehicle=state.vehicles.find(item=>String(item.auto_id)===String(autoId));if(!vehicle)return;
  uiState.detailsOpen=true;
  const driver=vehicle.driver_name||"ไม่ระบุ",status=statusLabel(vehicle.current_status);
  const html=`<div class="vehicle-detail-status" style="--status-color:${safeColor(vehicle.alert_color)}"><span></span><b>${escapeHtml(status)} · ${alertLevelLabel(vehicle.alert_level)}</b></div><div class="confirm-grid vehicle-detail-grid"><span>Auto ID</span><b>${escapeHtml(vehicle.auto_id)}</b><span>เลขนัดหมาย</span><b>${escapeHtml(vehicle.appointment_no||"ไม่ระบุ")}</b><span>บริษัท</span><b>${escapeHtml(vehicle.company_name||"ไม่ระบุ")}</b><span>ชื่อคนขับรถ</span><b>${escapeHtml(driver)}</b><span>ทะเบียนรถ</span><b>${escapeHtml(joinText(vehicle.vehicle_plate,vehicle.province))}</b><span>ประเภทรถ</span><b>${escapeHtml(vehicle.vehicle_type||"ไม่ระบุ")}</b><span>ประตู</span><b>${escapeHtml(vehicle.door_code||"ไม่ระบุ")}</b><span>เวลาสถานะนี้</span><b>${formatDuration(vehicle.stage_elapsed_seconds)}</b><span>เวลารวมในพื้นที่</span><b>${formatDuration(vehicle.total_elapsed_seconds)}</b><span>Gate In</span><b>${escapeHtml(formatDate(vehicle.gate_in_at))}</b><span>ยื่นเอกสาร</span><b>${escapeHtml(formatDate(vehicle.document_submitted_at))}</b><span>ตรวจเอกสารเสร็จ</span><b>${escapeHtml(formatDate(vehicle.document_checked_at))}</b><span>เริ่มตรวจรับ</span><b>${escapeHtml(formatDate(vehicle.receiving_started_at))}</b><span>รับสินค้าเสร็จ</span><b>${escapeHtml(formatDate(vehicle.receiving_completed_at))}</b><span>รับเอกสารคืน</span><b>${escapeHtml(formatDate(vehicle.document_returned_at))}</b></div>`;
  try{if(window.Swal)await Swal.fire({title:"รายละเอียดรถ",html,confirmButtonText:"ปิด",customClass:swalClasses(),buttonsStyling:false,width:440});else window.alert(`${vehicle.appointment_no||vehicle.auto_id} — ${status}`)}
  finally{uiState.detailsOpen=false}
}

async function toggleFullscreen(){
  if(state.view==="datatable"){
    const active=Boolean(datatableState.immersive||document.fullscreenElement);
    if(active){
      datatableState.immersive=false;
      if(document.fullscreenElement){try{await document.exitFullscreen()}catch{}}
      datatableState.nativeFullscreen=false;
    }else{
      datatableState.immersive=true;syncDatatableFullscreenShell();
      try{
        const target=document.documentElement;
        if(target?.requestFullscreen){await target.requestFullscreen({navigationUI:"hide"});datatableState.nativeFullscreen=true}
        else datatableState.nativeFullscreen=false;
      }catch{datatableState.nativeFullscreen=false}
    }
    updateFullscreenButton();syncDatatableFullscreenShell();return;
  }
  try{if(!document.fullscreenElement){if(!document.documentElement.requestFullscreen)throw new Error("unsupported");await document.documentElement.requestFullscreen({navigationUI:"hide"})}else await document.exitFullscreen()}
  catch{showNotice("info","เบราว์เซอร์นี้ไม่รองรับการเปิดเต็มหน้าจอ")}
  updateFullscreenButton();syncDashboardFullscreenShell();syncDatatableFullscreenShell();
}
function updateFullscreenButton(){
  const datatableActive=state.view==="datatable"&&Boolean(datatableState.immersive||document.fullscreenElement),label=(datatableActive||document.fullscreenElement)?"ออกจากเต็มจอ":"เต็มจอ";
  [$("fullscreenButton"),$("dashboardFullscreen"),$("dtFullscreen")].filter(Boolean).forEach(button=>button.textContent=label);
  const mobileButton=$("dashboardMobileFullscreen"),mobileLabel=mobileButton?.querySelector("span");if(mobileLabel)mobileLabel.textContent=label;
}

function normalizeAutoId(value){return String(value??"").replace(/[\r\n\t]/g,"").trim()}
function unlockAudio(){try{audioContext=audioContext||new(window.AudioContext||window.webkitAudioContext)();if(audioContext.state==="suspended")audioContext.resume()}catch{}}
function playFeedbackSound(kind){
  unlockAudio();if(!audioContext)return;
  const notes=kind==="success"?[[660,0,.09],[880,.11,.13]]:kind==="duplicate"?[[520,0,.1],[520,.15,.1],[390,.3,.16]]:kind==="error"?[[220,0,.12],[180,.15,.16]]:kind==="warning"?[[740,0,.11],[740,.18,.11],[980,.36,.18]]:[[940,0,.09]];
  notes.forEach(([frequency,delay,duration])=>{const oscillator=audioContext.createOscillator(),gain=audioContext.createGain(),start=audioContext.currentTime+delay;oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency,start);gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.13,start+.012);gain.gain.exponentialRampToValueAtTime(.0001,start+duration);oscillator.connect(gain).connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.02)});
}
function showKioskMessage(text,success){const toast=$("toast");if(!toast)return;toast.hidden=false;toast.classList.toggle("toast-error",!success);const label=toast.querySelector("span"),mark=toast.querySelector("b");if(label)label.textContent=text;if(mark)mark.textContent=success?"✓":"!";window.setTimeout(()=>{toast.hidden=true;toast.classList.remove("toast-error")},success?2600:5000)}
async function refreshInboundKioskData(){const data=await api(activeVehiclesApiPath());applyVehicleData(data);restoreInboundMainDisplay()}
function clearInboundInput(){const input=$("autoSearch");if(input)input.value=""}
function restoreInboundMainDisplay(){clearInboundInput();if(state.view!=="inbound"||!$("inboundRows"))return;renderInboundRows();updateInboundMetrics();window.setTimeout(()=>$("autoSearch")?.focus({preventScroll:true}),30)}
function syncInboundStageSummary(){
  const counts=statusCounts(),documentCheckOn=state.documentCheckEnabled||Number(counts.WAITING_DOCUMENT_CHECK||0)>0;
  const values={ALL:state.vehicles.filter(v=>!String(v.current_status||"").startsWith("REJECTED_")).length,WAITING_DOCUMENT_SUBMISSION:counts.WAITING_DOCUMENT_SUBMISSION||0,WAITING_DOCUMENT_CHECK:counts.WAITING_DOCUMENT_CHECK||0,READY_FOR_RECEIVING:counts.READY_FOR_RECEIVING||0,REJECTED_WAITING_DOCUMENT_RETURN:counts.REJECTED_WAITING_DOCUMENT_RETURN||0};
  const metricValues={metricWaiting:values.WAITING_DOCUMENT_SUBMISSION,metricDocumentCheck:values.WAITING_DOCUMENT_CHECK,metricReady:values.READY_FOR_RECEIVING,metricTotal:state.vehicles.length};
  Object.entries(metricValues).forEach(([id,value])=>{if($(id))$(id).textContent=Number(value)||0});
  document.querySelectorAll('[data-stage-count]').forEach(button=>{const badge=button.querySelector('b'),key=button.dataset.stageCount||'ALL';if(badge)badge.textContent=Number(values[key]||0)});
  const metric=document.getElementById('metricDocumentCheck')?.closest('.inbound-metric');
  if(metric)metric.hidden=!documentCheckOn;
}
function updateInboundMetrics(){syncInboundStageSummary()}
function statusCounts(){return state.vehicles.reduce((counts,vehicle)=>{counts[vehicle.current_status]=(counts[vehicle.current_status]||0)+1;return counts},{})}

function showNotice(icon,text){if(window.Swal)return Swal.fire({icon,title:text,confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:360});window.alert(text)}
function swalClasses(){return{popup:"wfv-swal",confirmButton:"wfv-swal-confirm",cancelButton:"wfv-swal-cancel"}}
function createIdempotencyKey(){return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`}


function datatableDateKey(date=new Date()){
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:cfg.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(date),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return`${p.year}-${p.month}-${p.day}`
}
function datatableStageMeta(key=datatableState.stage){return datatableState.meta?.stages?.find(item=>item.key===key)||{key:"overview",label:"ภาพรวม",description:"สรุปข้อมูลทุกช่วง"}}
function datatableStageLabels(key=datatableState.stage){return({overview:["รถเข้า","สถานะ"],gate_to_document:["รถเข้า","ยื่นเอกสาร"],document_review:["ยื่นเอกสาร","ตรวจเสร็จ"],ready:["พร้อมตรวจรับ","เริ่มตรวจรับ"],receiving:["เริ่มตรวจ","รับเสร็จ"],return:["รับเสร็จ","คืนเอกสาร"],gate_out:["พร้อมออก","ออกจากพื้นที่"],total:["รถเข้า","ออกจากพื้นที่"]})[key]||["เริ่ม","สิ้นสุด"]}
async function renderDatatable(){
  if(!["ADMIN","USER"].includes(state.user?.accessRights))return navigate(state.user?.accessRights==="INBOUND"?"inbound":"operations");
  if(window.innerWidth<=760&&!document.fullscreenElement){datatableState.immersive=false;datatableState.nativeFullscreen=false;$("appView")?.classList.remove("datatable-fullscreen-shell");document.body.classList.remove("datatable-fullscreen-active")}
  if(!datatableState.from){datatableState.from=datatableDateKey();datatableState.to=datatableState.from}
  $("pageContent").innerHTML=`<div class="loading">กำลังเตรียม Datatable</div>`;
  try{if(!datatableState.meta)datatableState.meta=await api("/api/datatable/meta");if(state.view!=="datatable")return;if(!datatableState.filterHistoryReady)datatableRestoreFilterSession();renderDatatableLayout();await loadDatatable(true)}catch(error){if(state.view==="datatable")$("pageContent").innerHTML=`<div class="empty-state"><b>โหลด Datatable ไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span></div>`}
}
function datatableStageToneClass(key){return({overview:"stage-overview",gate_to_document:"stage-gate_to_document",document_review:"stage-document_review",ready:"stage-ready",receiving:"stage-receiving",document_return:"stage-document_return",gate_out:"stage-gate_out",total:"stage-total"})[key]||"stage-overview"}
function datatableStageAccentColor(key){return({overview:"#2563EB",gate_to_document:"#0EA5E9",document_review:"#8B5CF6",ready:"#B7791F",receiving:"#EA580C",document_return:"#2563EB",gate_out:"#16A34A",total:"#64748B"})[key]||"#2563EB"}
function renderDatatableLayout(){
  const meta=datatableState.meta||{},exclusionAllowed=state.user?.accessRights==="ADMIN"||meta.vehicleExclusion?.userEnabled!==false,appointmentRules=normalizeAppointmentValidationClient(meta.appointmentValidation||{}),stages=(meta.stages||[]).filter(s=>meta.documentCheckEnabled||s.key!=="document_review"),shiftOptions=(meta.shifts||[]).map(s=>`<option value="${escapeHtml(s.shift_id)}">${escapeHtml(s.shift_name)} · ${minuteToTime(s.start_minute)}–${minuteToTime(s.end_minute)}</option>`).join(""),doorOptions=(meta.doors||[]).map(d=>`<option value="${escapeHtml(d.door_code)}">${escapeHtml(d.door_code)}</option>`).join(""),actorOptions=(meta.actors||[]).map(a=>`<option value="${escapeHtml(a.name)}">${escapeHtml(a.name)}</option>`).join("");
  $("pageContent").innerHTML=`<section class="dt-page dt-clean-page dt-r100-page ${datatableState.mobileFiltersOpen?"dt-mobile-filters-open":""}">
    <section class="dt-r100-top">
      <div class="dt-r100-controls">
        <label><span id="dtFromLabel">วันที่เริ่ม</span><input id="dtFrom" type="date" value="${escapeHtml(datatableState.from)}"></label>
        <label><span id="dtToLabel">วันที่สิ้นสุด</span><input id="dtTo" type="date" value="${escapeHtml(datatableState.to)}"></label>
        <label class="dt-r100-shift"><span>กะ</span><select id="dtShift"><option value="">ทุกกะ</option>${shiftOptions}</select></label>
        <div class="dt-r100-actions"><button id="dtCompare" class="dt-compare-open" type="button">เปรียบเทียบ</button><button id="dtRefresh" class="quiet-button" type="button">รีเฟรช</button><button id="dtFullscreen" class="outline-button" type="button">เต็มจอ</button><button id="dtExport" class="primary" type="button">ส่งออก</button></div>
        <div class="dt-r100-live"><i></i><div><b id="dtPanelStatus">พร้อมใช้งาน</b><small id="dtPanelStatusSub">กำลังโหลดข้อมูล</small></div></div>
        <span id="dtShiftHint" class="dt-shift-hint dt-r100-shift-hint" hidden></span>
        <div id="dtBusinessDateNote" class="dt-business-date-note" hidden></div>
      </div>
      <div class="dt-mobile-toolbelt"><button id="dtMobileFilterToggle" class="outline-button dt-mobile-tool" type="button">ตัวกรอง</button><button id="dtMobileCompare" class="dt-compare-open dt-mobile-tool" type="button">เปรียบเทียบ</button><button id="dtMobileRefresh" class="quiet-button dt-mobile-tool" type="button">รีเฟรช</button><button id="dtMobileExport" class="primary dt-mobile-tool" type="button">ส่งออก</button></div>
      <div class="dt-r100-stagebar">
        <nav id="dtStageTabs" class="dt-stage-tabs dt-stage-tabs-r100">${stages.map(s=>`<button type="button" data-dt-stage="${s.key}" class="${datatableState.stage===s.key?"active":""} ${datatableStageToneClass(s.key)}"><span>${escapeHtml(s.label)}</span></button>`).join("")}</nav>
      </div>
      <section id="dtCurrentRuleBanner" class="dt-current-rule dt-current-rule-r100 dt-current-rule-top dt-current-rule-banner" style="--dt-stage-accent:${datatableStageAccentColor(datatableState.stage)}"><div class="dt-current-rule-title"><span class="dt-rule-mark" aria-hidden="true"></span><div><small>เกณฑ์เวลาของช่วงนี้</small><b id="dtRuleStageName">${escapeHtml(datatableStageMeta().label)}</b></div></div><div id="dtCurrentRules" class="dt-current-rule-levels"></div><div class="dt-current-rule-actions"><button id="dtAllRules" class="quiet-button" type="button">เกณฑ์ทั้งหมด</button><button id="dtActivityButton" class="quiet-button" type="button">กิจกรรม</button></div></section>
      <section id="dtMobileSummary" class="dt-mobile-summary" aria-label="สรุปข้อมูล"><div><small>ทั้งหมด</small><b data-dt-mobile-summary="total">0</b></div><div><small>กำลังดำเนินการ</small><b data-dt-mobile-summary="active">0</b></div><div><small>เกินเวลา</small><b data-dt-mobile-summary="warning">0</b></div><div><small>เสร็จสิ้น</small><b data-dt-mobile-summary="completed">0</b></div></section>
    </section>
    <main class="dt-main dt-main-full">
      <section class="dt-filter-shell dt-filter-shell-compact">
        <div class="dt-filterbar dt-filterbar-r159">
          <div class="dt-search"><input id="dtSearch" value="${escapeHtml(datatableState.search)}" placeholder="ค้นหาเลขนัดหมาย / บริษัท / ทะเบียน / คนขับ"><span aria-hidden="true">⌕</span></div>
          <select id="dtSla"><option value="ALL">ทุกระดับแจ้งเตือน</option>${["NORMAL","WATCH","WARNING","URGENT","CRITICAL"].map(v=>`<option value="${v}">${alertLevelLabel(v)}</option>`).join("")}</select>
          <select id="dtStatus"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE">ระหว่างดำเนินการ</option><option value="CLOSED">เสร็จสิ้น</option><option value="REJECTED">ปฏิเสธรับสินค้า</option>${Object.keys(DATATABLE_STATUS_OPTIONS).map(v=>`<option value="${v}">${DATATABLE_STATUS_OPTIONS[v]}</option>`).join("")}</select>
          <select id="dtDoor"><option value="">ทุกประตู</option>${doorOptions}</select>
          <select id="dtActor"><option value="">ผู้ดำเนินการทั้งหมด</option>${actorOptions}</select>
          <select id="dtSort"><option value="start_desc">เรียงล่าสุด</option><option value="start_asc">เรียงเก่าสุด</option><option value="duration_desc">ใช้เวลามากสุด</option><option value="duration_asc">ใช้เวลาน้อยสุด</option><option value="appointment_asc">เลขนัดหมาย น้อย → มาก</option><option value="appointment_desc">เลขนัดหมาย มาก → น้อย</option><option value="company_asc">บริษัท A → Z</option></select>
          <button id="dtProblem" class="outline-button dt-problem-compact ${datatableState.problemOnly?"is-active":""}" type="button" title="แสดงเฉพาะรายการแจ้งเตือน">แจ้งเตือน</button>
          <details id="dtMoreActions" class="dt-more-actions">
            <summary><span id="dtMoreLabel">เพิ่มเติม</span></summary>
            <div class="dt-more-menu">
              <div id="dtFilterStateNote" class="dt-filter-state-note">ไม่มีตัวกรองเพิ่มเติม</div>
              <div class="dt-filter-history-actions"><button id="dtFilterBack" class="quiet-button" type="button">ย้อนก่อนหน้า</button><button id="dtFilterForward" class="quiet-button" type="button">ถัดไป</button></div>
              ${appointmentRules.enabled?`<button id="dtInvalidAppointment" class="outline-button dt-missing-button ${datatableState.invalidAppointmentOnly?"is-active":""}" type="button">นัดหมายผิด</button>`:""}
              ${exclusionAllowed?`<button id="dtExcludedList" class="outline-button dt-exclusions-button" type="button">นำออกแล้ว</button>`:""}
              <button id="dtColumns" class="outline-button" type="button">คอลัมน์</button>
              <button id="dtReset" class="quiet-button" type="button">ล้างตัวกรอง</button>
            </div>
          </details>
        </div>
      </section>
      <section class="dt-table-card"><div id="dtTable" class="dt-table-wrap"><div class="loading">กำลังโหลดข้อมูล</div></div><footer id="dtPager" class="dt-pager"></footer></section></main>
  </section>`;
  $("dtShift").value=datatableState.shiftId;$("dtSla").value=datatableState.sla;$("dtStatus").value=datatableState.status;$("dtDoor").value=datatableState.door;$("dtActor").value=datatableState.actor;$("dtSort").value=datatableState.sort;
  renderDatatableSide();syncDatatableShiftHint();syncDatatableDateLabels();renderDatatableBusinessDateNote();bindDatatableEvents();syncDatatableFilterIndicators();updateFullscreenButton();toggleDatatableMobileFilters(window.innerWidth>760?true:datatableState.mobileFiltersOpen);
}
const DATATABLE_STATUS_OPTIONS={WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",WAITING_DOCUMENT_CHECK:"รอตรวจเอกสาร",READY_FOR_RECEIVING:"พร้อมตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",WAITING_GATE_OUT:"รอออกจากพื้นที่",REJECTED_WAITING_DOCUMENT_RETURN:"ปฏิเสธ · รอคืนเอกสาร",REJECTED_WAITING_GATE_OUT:"ปฏิเสธ · รอออก",CLOSED:"ปิดงาน"};
function missingAppointmentValue(value){const text=String(value??"").trim(),upper=text.toUpperCase();return !text||["-","N/A","NA","NONE"].includes(upper)||text==="ไม่มี"||/^0+$/.test(text)}
function normalizeAppointmentValidationClient(input={}){const lengths=[...new Set((Array.isArray(input.allowedLengths)?input.allowedLengths:String(input.allowedLengths??"").split(/[\s,;|]+/)).map(v=>Math.floor(Number(v))).filter(v=>Number.isInteger(v)&&v>=1&&v<=64))].sort((a,b)=>a-b),blocked=[...new Set((Array.isArray(input.blockedValues)?input.blockedValues:String(input.blockedValues??"").split(/[\n,;|]+/)).map(v=>String(v??"").trim()).filter(Boolean).map(v=>v.toUpperCase()))];return{enabled:input.enabled===true||input.enabled===1||input.enabled==="1",allowedLengths:lengths,numericOnly:input.numericOnly!==false&&input.numericOnly!==0&&input.numericOnly!=="0",blockAllZero:input.blockAllZero!==false&&input.blockAllZero!==0&&input.blockAllZero!=="0",blockedValues:blocked}}
function appointmentValidationClient(value,rules=datatableState.meta?.appointmentValidation){const cfg=normalizeAppointmentValidationClient(rules||{}),text=String(value??"").trim();if(!cfg.enabled)return{enabled:false,valid:true,code:null,message:null,length:text.length};if(!text)return{enabled:true,valid:false,code:"EMPTY",message:"ไม่มีเลขนัดหมาย",length:0};const upper=text.toUpperCase();if(cfg.blockAllZero&&/^0+$/.test(text))return{enabled:true,valid:false,code:"ZERO",message:"เป็นเลข 0 ทั้งชุด",length:text.length};if(cfg.blockedValues.includes(upper))return{enabled:true,valid:false,code:"BLOCKED",message:"เป็นเลขที่ห้ามใช้",length:text.length};if(cfg.numericOnly&&!/^\d+$/.test(text))return{enabled:true,valid:false,code:"FORMAT",message:"ต้องเป็นตัวเลขเท่านั้น",length:text.length};if(cfg.allowedLengths.length&&!cfg.allowedLengths.includes(text.length))return{enabled:true,valid:false,code:"LENGTH",message:`จำนวนหลักไม่ถูกต้อง · ต้องเป็น ${cfg.allowedLengths.join(" หรือ ")} หลัก`,length:text.length};return{enabled:true,valid:true,code:null,message:"เลขนัดหมายถูกต้องตามกฎ",length:text.length}}
function datatableAppointmentValidation(row){return row?.appointmentValidation||appointmentValidationClient(row?.appointmentNo??row?.appointment_no)}
function datatableAppointmentBadge(row){const check=datatableAppointmentValidation(row);return check?.enabled&&!check.valid?`<span class="dt-appointment-warning" title="${escapeHtml(check.message||"เลขนัดหมายไม่ถูกต้อง")}">เลขผิด</span>`:""}
function datatableMissingAppointment(row){return missingAppointmentValue(row?.appointmentNo??row?.appointment_no)}
function datatableExclusionAllowed(){const role=state.user?.accessRights||"";return role==="ADMIN"||(role==="USER"&&datatableState.meta?.vehicleExclusion?.userEnabled!==false)}
function datatableCanRequestExclusion(row,status=row?.currentStatus??row?.current_status){return datatableExclusionAllowed()&&["WAITING_DOCUMENT_SUBMISSION","CLOSED"].includes(String(status||""))}
const DATATABLE_FILTER_SESSION_KEY="wvf_dt_filter_state_r160";
function datatableFilterSnapshot(){return{stage:datatableState.stage,from:datatableState.from,to:datatableState.to,shiftId:datatableState.shiftId,search:datatableState.search,sla:datatableState.sla,status:datatableState.status,door:datatableState.door,actor:datatableState.actor,sort:datatableState.sort,page:datatableState.page,problemOnly:Boolean(datatableState.problemOnly),rejectedOnly:Boolean(datatableState.rejectedOnly),invalidAppointmentOnly:Boolean(datatableState.invalidAppointmentOnly)}}
function datatableFilterSnapshotKey(value=datatableFilterSnapshot()){return JSON.stringify(value)}
function datatableApplyFilterSnapshot(snapshot={}){const stages=new Set((datatableState.meta?.stages||[]).map(item=>item.key)),stage=stages.has(String(snapshot.stage||""))?String(snapshot.stage):"overview",date=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||""))?String(value):datatableDateKey();datatableState.stage=stage;datatableState.from=date(snapshot.from);datatableState.to=date(snapshot.to||snapshot.from);datatableState.shiftId=String(snapshot.shiftId||"");datatableState.search=String(snapshot.search||"");datatableState.sla=["ALL","NORMAL","WATCH","WARNING","URGENT","CRITICAL"].includes(String(snapshot.sla||"ALL"))?String(snapshot.sla||"ALL"):"ALL";datatableState.status=String(snapshot.status||"ALL");datatableState.door=String(snapshot.door||"");datatableState.actor=String(snapshot.actor||"");datatableState.sort=String(snapshot.sort||"start_desc");datatableState.page=Math.max(1,Number(snapshot.page)||1);datatableState.problemOnly=Boolean(snapshot.problemOnly);datatableState.rejectedOnly=Boolean(snapshot.rejectedOnly);datatableState.invalidAppointmentOnly=Boolean(snapshot.invalidAppointmentOnly)}
function datatablePersistFilterSession(){try{sessionStorage.setItem(DATATABLE_FILTER_SESSION_KEY,JSON.stringify({savedAt:Date.now(),current:datatableFilterSnapshot(),back:datatableState.filterBack.slice(-20),forward:datatableState.filterForward.slice(-20)}))}catch{}}
function datatableRestoreFilterSession(){datatableState.filterHistoryReady=true;try{const raw=sessionStorage.getItem(DATATABLE_FILTER_SESSION_KEY);if(!raw)return;const saved=JSON.parse(raw);if(!saved?.current||Date.now()-Number(saved.savedAt||0)>12*60*60*1000)return;datatableApplyFilterSnapshot(saved.current);datatableState.filterBack=Array.isArray(saved.back)?saved.back.slice(-20):[];datatableState.filterForward=Array.isArray(saved.forward)?saved.forward.slice(-20):[]}catch{datatableState.filterBack=[];datatableState.filterForward=[]}}
function datatableRememberBeforeChange(){if(datatableState.filterApplyingHistory)return false;const current=datatableFilterSnapshot(),key=datatableFilterSnapshotKey(current),last=datatableState.filterBack.at(-1);let pushed=false;if(!last||datatableFilterSnapshotKey(last)!==key){datatableState.filterBack.push(current);pushed=true}if(datatableState.filterBack.length>20)datatableState.filterBack.shift();datatableState.filterForward=[];return pushed}
function datatableFilterActiveCount(){let count=0;if(datatableState.search)count++;if(datatableState.sla!=="ALL")count++;if(datatableState.status!=="ALL")count++;if(datatableState.shiftId)count++;if(datatableState.door)count++;if(datatableState.actor)count++;if(datatableState.problemOnly)count++;if(datatableState.rejectedOnly)count++;if(datatableState.invalidAppointmentOnly)count++;return count}
function datatableHiddenFilterCount(){return Number(Boolean(datatableState.invalidAppointmentOnly))+Number(Boolean(datatableState.rejectedOnly))}
function datatableFilterDescriptions(){const values=[];if(datatableState.search)values.push(`ค้นหา “${datatableState.search}”`);if(datatableState.sla!=="ALL")values.push(alertLevelLabel(datatableState.sla));if(datatableState.status!=="ALL")values.push($("dtStatus")?.selectedOptions?.[0]?.textContent||datatableState.status);if(datatableState.shiftId)values.push($("dtShift")?.selectedOptions?.[0]?.textContent||"เลือกกะ");if(datatableState.door)values.push(`ประตู ${datatableState.door}`);if(datatableState.actor)values.push(`ผู้ดำเนินการ ${datatableState.actor}`);if(datatableState.problemOnly)values.push("เฉพาะแจ้งเตือน");if(datatableState.invalidAppointmentOnly)values.push("นัดหมายผิด");if(datatableState.rejectedOnly)values.push("ปฏิเสธรับสินค้า");return values}
function syncDatatableFilterIndicators(){const hidden=datatableHiddenFilterCount(),active=datatableFilterActiveCount(),details=$("dtMoreActions"),more=$("dtMoreLabel"),summary=details?.querySelector("summary"),problem=$("dtProblem"),invalid=$("dtInvalidAppointment"),reset=$("dtReset"),note=$("dtFilterStateNote"),back=$("dtFilterBack"),forward=$("dtFilterForward"),mobile=$("dtMobileFilterToggle");if(more)more.textContent=hidden?`เพิ่มเติม (${hidden})`:"เพิ่มเติม";summary?.classList.toggle("is-active",hidden>0);details?.classList.toggle("has-active",hidden>0);if(problem){problem.classList.toggle("is-active",datatableState.problemOnly);problem.textContent=datatableState.problemOnly?"✓ แจ้งเตือน":"แจ้งเตือน"}if(invalid){invalid.classList.toggle("is-active",datatableState.invalidAppointmentOnly);invalid.textContent=datatableState.invalidAppointmentOnly?"✓ นัดหมายผิด":"นัดหมายผิด"}if(reset)reset.textContent=active?`ล้างตัวกรอง (${active})`:"ล้างตัวกรอง";if(note){const items=datatableFilterDescriptions();note.textContent=items.length?`กำลังใช้: ${items.join(" · ")}`:"ไม่มีตัวกรองเพิ่มเติม";note.classList.toggle("has-filter",items.length>0)}if(back)back.disabled=!datatableState.filterBack.length;if(forward)forward.disabled=!datatableState.filterForward.length;if(mobile)mobile.textContent=active?`ตัวกรอง (${active})`:"ตัวกรอง";[["dtSearch",Boolean(datatableState.search)],["dtSla",datatableState.sla!=="ALL"],["dtStatus",datatableState.status!=="ALL"],["dtShift",Boolean(datatableState.shiftId)],["dtDoor",Boolean(datatableState.door)],["dtActor",Boolean(datatableState.actor)]].forEach(([id,on])=>$(id)?.classList.toggle("is-filtered",Boolean(on)))}
function datatableCommitFilterChange(mutator,{after=null,resetPage=true}={}){const before=datatableFilterSnapshotKey(),pushed=datatableRememberBeforeChange();mutator();if(resetPage)datatableState.page=1;const changed=before!==datatableFilterSnapshotKey();if(!changed){if(pushed)datatableState.filterBack.pop();syncDatatableFilterIndicators();return}if(typeof after==="function")after();datatablePersistFilterSession();syncDatatableFilterIndicators();loadDatatable(resetPage)}
function datatableFilterUndo(){if(!datatableState.filterBack.length)return;const current=datatableFilterSnapshot(),target=datatableState.filterBack.pop();datatableState.filterForward.push(current);datatableState.filterApplyingHistory=true;datatableApplyFilterSnapshot(target);datatableState.filterApplyingHistory=false;datatablePersistFilterSession();renderDatatableLayout();loadDatatable(false)}
function datatableFilterRedo(){if(!datatableState.filterForward.length)return;const current=datatableFilterSnapshot(),target=datatableState.filterForward.pop();datatableState.filterBack.push(current);datatableState.filterApplyingHistory=true;datatableApplyFilterSnapshot(target);datatableState.filterApplyingHistory=false;datatablePersistFilterSession();renderDatatableLayout();loadDatatable(false)}
function bindDatatableEvents(){
  document.querySelectorAll("[data-dt-stage]").forEach(button=>button.addEventListener("click",()=>datatableCommitFilterChange(()=>{datatableState.stage=button.dataset.dtStage;datatableState.rejectedOnly=false},{after:()=>{document.querySelectorAll("[data-dt-stage]").forEach(b=>b.classList.toggle("active",b===button));renderDatatableSide()}})));
  $("dtFrom")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.shiftAutoDate=false;datatableState.from=$("dtFrom").value},{after:renderDatatableBusinessDateNote}));
  $("dtTo")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.shiftAutoDate=false;datatableState.to=$("dtTo").value},{after:renderDatatableBusinessDateNote}));
  $("dtShift")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.shiftId=$("dtShift").value;adjustDatatableDateForCrossDayShift()},{after:()=>{syncDatatableShiftHint();syncDatatableDateLabels();renderDatatableBusinessDateNote()}}));
  $("dtSearch")?.addEventListener("input",()=>{clearTimeout(datatableState.searchTimer);datatableState.searchTimer=setTimeout(()=>{const value=$("dtSearch")?.value.trim()||"";datatableCommitFilterChange(()=>{datatableState.search=value})},350)});
  $("dtSla")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.sla=$("dtSla").value}));
  $("dtStatus")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.status=$("dtStatus").value;datatableState.rejectedOnly=false}));
  $("dtDoor")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.door=$("dtDoor").value}));
  $("dtActor")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.actor=$("dtActor").value}));
  $("dtSort")?.addEventListener("change",()=>datatableCommitFilterChange(()=>{datatableState.sort=$("dtSort").value}));
  $("dtProblem")?.addEventListener("click",()=>datatableCommitFilterChange(()=>{const next=!datatableState.problemOnly;datatableState.problemOnly=next;if(next){datatableState.invalidAppointmentOnly=false;datatableState.rejectedOnly=false}}));
  $("dtInvalidAppointment")?.addEventListener("click",()=>datatableCommitFilterChange(()=>{const next=!datatableState.invalidAppointmentOnly;datatableState.invalidAppointmentOnly=next;if(next){datatableState.problemOnly=false;datatableState.rejectedOnly=false}}));
  $("dtFilterBack")?.addEventListener("click",datatableFilterUndo);$("dtFilterForward")?.addEventListener("click",datatableFilterRedo);
  $("dtExcludedList")?.addEventListener("click",showVehicleExclusions);$("dtReset")?.addEventListener("click",resetDatatableFilters);$("dtCompare")?.addEventListener("click",showDatatableCompare);$("dtRefresh")?.addEventListener("click",refreshDatatableAll);$("dtFullscreen")?.addEventListener("click",toggleFullscreen);$("dtExport")?.addEventListener("click",downloadDatatableExport);$("dtColumns")?.addEventListener("click",chooseDatatableColumns);$("dtAllRules")?.addEventListener("click",showDatatableAllRules);$("dtActivityButton")?.addEventListener("click",showDatatableActivity);document.querySelectorAll("#dtMoreActions button").forEach(button=>button.addEventListener("click",()=>{const menu=$("dtMoreActions");if(menu)menu.open=false}));
  $("dtMobileFilterToggle")?.addEventListener("click",()=>toggleDatatableMobileFilters());$("dtMobileCompare")?.addEventListener("click",showDatatableCompare);$("dtMobileRefresh")?.addEventListener("click",refreshDatatableAll);$("dtMobileExport")?.addEventListener("click",downloadDatatableExport);
  bindDatatableViewportWatcher();
  document.querySelectorAll("[data-dt-quick]").forEach(button=>button.addEventListener("click",()=>runDatatableQuick(button.dataset.dtQuick)));
  $("dtTable")?.addEventListener("click",event=>{const exclude=event.target.closest("[data-dt-exclude]");if(exclude)return runDatatableExclude(exclude.dataset.dtExclude,exclude);const detail=event.target.closest("[data-dt-detail]");if(detail)return showDatatableDetail(detail.dataset.dtDetail,detail);const command=event.target.closest("[data-dt-command]");if(command)return runDatatableCommand(command.dataset.dtCommand,command)});
  $("dtPager")?.addEventListener("click",event=>{const button=event.target.closest("[data-dt-page]");if(!button)return;datatableState.page=Math.max(1,Number(button.dataset.dtPage)||1);datatablePersistFilterSession();loadDatatable(false);document.querySelector(".dt-table-card")?.scrollIntoView({behavior:"smooth",block:"start"})});
}
async function refreshDatatableAll(){if(datatableState.busy){datatableState.refreshMetaRequested=true;return}datatableState.refreshMetaRequested=false;try{datatableState.meta=await api("/api/datatable/meta");if(!datatableState.meta.documentCheckEnabled&&datatableState.stage==="document_review")datatableState.stage="overview";renderDatatableLayout();await loadDatatable(true)}catch(error){await showNotice("error",error.message||"รีเฟรชข้อมูลไม่สำเร็จ")}}
function resetDatatableFilters(){datatableCommitFilterChange(()=>{datatableState.search="";datatableState.sla="ALL";datatableState.status="ALL";datatableState.door="";datatableState.actor="";datatableState.problemOnly=false;datatableState.rejectedOnly=false;datatableState.invalidAppointmentOnly=false;datatableState.sort="start_desc"},{after:()=>{["dtSearch","dtDoor","dtActor"].forEach(id=>{if($(id))$(id).value=""});if($("dtSla"))$("dtSla").value="ALL";if($("dtStatus"))$("dtStatus").value="ALL";if($("dtSort"))$("dtSort").value="start_desc";if(window.innerWidth<=760)toggleDatatableMobileFilters(false)}})}
function datatableParams({page=true}={}){const q=new URLSearchParams({from:datatableState.from,to:datatableState.to,stage:datatableState.stage,limit:String(datatableState.limit),search:datatableState.search,sla:datatableState.sla,status:datatableState.status,shiftId:datatableState.shiftId,door:datatableState.door,actor:datatableState.actor,sort:datatableState.sort,problemOnly:datatableState.problemOnly?"1":"0",rejectedOnly:datatableState.rejectedOnly?"1":"0",invalidAppointmentOnly:datatableState.invalidAppointmentOnly?"1":"0"});if(page)q.set("page",String(datatableState.page));return q}
async function loadDatatable(reset=false){
  if(state.view!=="datatable")return;if(reset)datatableState.page=1;
  if(datatableState.busy){datatableState.reloadRequested=true;return}
  datatableState.busy=true;datatableState.reloadRequested=false;const requestKey=datatableParams().toString(),table=$("dtTable"),seq=++datatableState.requestSeq;if(table&&!datatableState.data)table.innerHTML=`<div class="loading">กำลังโหลดข้อมูล</div>`;
  try{const data=await api(`/api/datatable?${requestKey}`);if(state.view!=="datatable"||seq!==datatableState.requestSeq)return;if(requestKey!==datatableParams().toString()){datatableState.reloadRequested=true;return}datatableState.data=data;if(datatableState.page>Number(data.pages||1)){datatableState.page=Number(data.pages||1);datatableState.reloadRequested=true;return}renderDatatableData(data)}catch(error){if(table)table.innerHTML=`<div class="empty-state"><b>โหลดข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="dtRetry" class="outline-button" type="button">ลองใหม่</button></div>`;$("dtRetry")?.addEventListener("click",()=>loadDatatable(true))}finally{datatableState.busy=false;if(state.view==="datatable"&&datatableState.refreshMetaRequested){datatableState.refreshMetaRequested=false;datatableState.reloadRequested=false;void refreshDatatableAll()}else if(datatableState.reloadRequested&&state.view==="datatable"){datatableState.reloadRequested=false;void loadDatatable(false)}}
}
function renderDatatableData(data){renderDatatableSummary(data.summary||{});renderDatatableHeaderStatus(data);renderDatatableRows(data.items||[]);renderDatatablePager(data);renderDatatableActivity(data.activity||[],data.generatedAt);renderDatatableSide();syncDatatableShiftHint(data.shiftContext);renderDatatableBusinessDateNote(data.shiftContext)}
function renderDatatableSummary(summary){
  const el=$("dtPanelStatusSub");if(!el)return;
  const total=Number(summary.total||0),active=Number(summary.active||0),warnings=Number(summary.warnings||0),rejected=Number(summary.rejected||0),completed=Number(summary.completed||0);
  el.textContent=`ทั้งหมด ${total.toLocaleString("th-TH")} · กำลัง ${active.toLocaleString("th-TH")} · เตือน ${warnings.toLocaleString("th-TH")} · ปฏิเสธ ${rejected.toLocaleString("th-TH")} · เสร็จ ${completed.toLocaleString("th-TH")}`;
  syncDatatableFilterIndicators();
  const values={total,active,warning:warnings,completed};Object.entries(values).forEach(([key,value])=>{const node=document.querySelector(`[data-dt-mobile-summary="${key}"]`);if(node)node.textContent=Number(value||0).toLocaleString("th-TH")});
}
function renderDatatableHeaderStatus(data){const total=Number(data.total||0),button=$("dtRefresh");if(button)button.title=`${total.toLocaleString("th-TH")} รายการ · อัปเดต ${formatDateShort(data.generatedAt)}`;if($("dtPanelStatus"))$("dtPanelStatus").textContent="พร้อมใช้งาน";}
function datatableColumnOn(name){return datatableState.columns.has(name)}
function datatableIsMobile(){return window.matchMedia("(max-width: 760px)").matches}
function datatableMobileDuration(row){if(datatableState.stage==="overview")return row.totalInSiteSeconds==null?"-":formatDuration(row.totalInSiteSeconds);return row.stageSeconds==null?"-":formatDuration(row.stageSeconds)}
function datatableMobileStageLabel(row){return datatableState.stage==="overview"?statusLabel(row.currentStatus):datatableStageMeta().label}
function datatableMobileCard(row){
  const policy=datatableActionPolicy(row,row.currentStatus),appointment=escapeHtml(row.appointmentNo||row.autoId),appointmentBadge=datatableAppointmentBadge(row),company=escapeHtml(row.companyName||"-"),plate=escapeHtml(joinText(row.vehiclePlate,row.province)),shift=escapeHtml(row.shiftName||"-"),actor=escapeHtml(row.stageActor||"ระบบ"),duration=datatableMobileDuration(row),level=alertLevelLabel(row.stageAlertLevel),accent=safeColor(row.stageAlertColor),stageLabel=escapeHtml(datatableMobileStageLabel(row)),door=row.doorCode?`<span class="dtm-meta-pill">ประตู ${escapeHtml(row.doorCode)}</span>`:"",business=row.shiftBusinessDate?`<span class="dtm-meta-pill">วันที่เริ่มกะ ${escapeHtml(formatDatatableBusinessDate(row.shiftBusinessDate))}</span>`:"";
  const command=policy.type==="none"?"":`<button class="dtm-action dtm-action-primary action-${escapeHtml(policy.type)}" type="button" data-dt-command="${escapeHtml(row.autoId)}">${escapeHtml(policy.label)}</button>`,remove=datatableCanRequestExclusion(row)?`<button class="dtm-action dtm-action-remove" type="button" data-dt-exclude="${escapeHtml(row.autoId)}">นำออก</button>`:"";
  return `<article class="dtm-record" style="--dtm-alert:${accent}">
    <header class="dtm-record-head"><div><small>เลขนัดหมาย</small><b>${appointment}${appointmentBadge}</b>${appointmentInline(row,"datatable")}</div><span class="dtm-alert"><i></i>${escapeHtml(level)}</span></header>
    <div class="dtm-record-body"><div class="dtm-identity"><strong>${company}</strong><span>${plate||"-"}</span><div class="dtm-meta">${business}${door}</div><span class="dtm-actor">${actor}</span></div><aside class="dtm-stage"><small>ขั้นตอนปัจจุบัน</small><b>${stageLabel}</b><span>เวลาในขั้นตอน</span><strong>${escapeHtml(duration)}</strong></aside></div>
    <footer class="dtm-record-actions ${remove?"has-remove":""}"><button class="dtm-action dtm-action-detail" type="button" data-dt-detail="${escapeHtml(row.autoId)}">รายละเอียด</button>${command}${remove}</footer>
  </article>`
}
function renderDatatableRows(items){
  const table=$("dtTable");if(!table)return;
  if(datatableIsMobile()){
    table.classList.add("dt-mobile-cards");table.classList.remove("is-overview");table.dataset.optionalColumns="0";
    table.innerHTML=items.length?`<div class="dtm-list">${items.map(datatableMobileCard).join("")}</div>`:`<div class="empty-state"><b>ไม่พบข้อมูลตามตัวกรอง</b><span>ลองเปลี่ยนวันที่ สถานะ หรือระดับแจ้งเตือน</span></div>`;return;
  }
  table.classList.remove("dt-mobile-cards");const overview=datatableState.stage==="overview",labels=datatableStageLabels();const optional=[datatableColumnOn("company")?`<span>บริษัท</span>`:"",datatableColumnOn("plate")?`<span>ทะเบียนรถ</span>`:"",datatableColumnOn("shift")?`<span>กะ</span>`:""] .join("");const actorHead=datatableColumnOn("actor")?`<span>ผู้ดำเนินการ</span>`:"";const headAccent=datatableStageAccentColor(datatableState.stage);const headClass=`dt-row dt-head ${datatableStageToneClass(datatableState.stage)}`;const head=overview?`<div class="${headClass}" style="--dt-head-accent:${headAccent}"><span>เลขนัดหมาย</span>${optional}<span>สถานะล่าสุด</span><span>เวลารวม</span><span>ระดับแจ้งเตือน</span><span>ประตู</span>${actorHead}<span>สั่งการ</span><span>รายละเอียด</span></div>`:`<div class="${headClass}" style="--dt-head-accent:${headAccent}"><span>เลขนัดหมาย</span>${optional}<span>${escapeHtml(labels[0])}</span><span>${escapeHtml(labels[1])}</span><span>ใช้เวลา</span><span>ระดับแจ้งเตือน</span>${actorHead}<span>สั่งการ</span><span>รายละเอียด</span></div>`;
  const body=items.length?items.map(row=>{const company=datatableColumnOn("company")?`<span class="dt-company dt-cell" data-label="บริษัท">${escapeHtml(row.companyName||"-")}</span>`:"",plate=datatableColumnOn("plate")?`<span class="dt-cell" data-label="ทะเบียนรถ">${escapeHtml(joinText(row.vehiclePlate,row.province))}</span>`:"",shift=datatableColumnOn("shift")?`<span class="dt-cell" data-label="กะ">${escapeHtml(row.shiftName||"-")}${row.shiftBusinessDate?`<small class="dt-shift-date">วันที่เริ่มกะ ${escapeHtml(row.shiftBusinessDate.slice(8,10)+"/"+row.shiftBusinessDate.slice(5,7))}</small>`:""}</span>`:"",actor=datatableColumnOn("actor")?`<span class="dt-cell" data-label="ผู้ดำเนินการ">${escapeHtml(row.stageActor||"ระบบ")}</span>`:"",sla=`<span class="dt-sla dt-cell" style="--dt-alert:${safeColor(row.stageAlertColor)}" data-label="ระดับแจ้งเตือน"><i></i><b>${alertLevelLabel(row.stageAlertLevel)}</b></span>`,policy=datatableActionPolicy(row,row.currentStatus),command=policy.type==="none"?`<span class="dt-no-action">-</span>`:`<button class="dt-command action-${escapeHtml(policy.type)} ${alertLevelRank(row.stageAlertLevel)>=3?"urgent":""}" type="button" data-dt-command="${escapeHtml(row.autoId)}">${escapeHtml(policy.label)}</button>`,detail=`<button class="dt-detail" type="button" data-dt-detail="${escapeHtml(row.autoId)}">รายละเอียด</button>`;if(overview)return`<div class="dt-row"><b class="dt-appointment-cell" data-label="เลขนัดหมาย">${escapeHtml(row.appointmentNo||row.autoId)}${datatableAppointmentBadge(row)}${appointmentInline(row,"datatable")}</b>${company}${plate}${shift}<span class="dt-cell" data-label="สถานะล่าสุด"><em class="dt-status ${statusTone(row.currentStatus)}">${statusLabel(row.currentStatus)}</em></span><b class="dt-cell" data-label="เวลารวม">${formatDuration(row.totalInSiteSeconds)}</b>${sla}<span class="dt-cell" data-label="ประตู">${escapeHtml(row.doorCode||"-")}</span>${actor}<span class="dt-cell dt-cell-command" data-label="สั่งการ">${command}</span><span class="dt-cell dt-cell-detail" data-label="รายละเอียด">${detail}</span></div>`;return`<div class="dt-row"><b class="dt-appointment-cell" data-label="เลขนัดหมาย">${escapeHtml(row.appointmentNo||row.autoId)}${datatableAppointmentBadge(row)}${appointmentInline(row,"datatable")}</b>${company}${plate}${shift}<span class="dt-cell" data-label="${escapeHtml(labels[0])}">${formatDateShort(row.stageStartAt)}</span><span class="dt-cell" data-label="${escapeHtml(labels[1])}">${formatDateShort(row.stageEndAt)}</span><b class="dt-cell" data-label="ใช้เวลา">${row.stageSeconds==null?"-":formatDuration(row.stageSeconds)}</b>${sla}${actor}<span class="dt-cell dt-cell-command" data-label="สั่งการ">${command}</span><span class="dt-cell dt-cell-detail" data-label="รายละเอียด">${detail}</span></div>`}).join(""):`<div class="empty-state"><b>ไม่พบข้อมูลตามตัวกรอง</b><span>ลองเปลี่ยนวันที่ สถานะ หรือระดับแจ้งเตือน</span></div>`;table.innerHTML=head+body;table.dataset.optionalColumns=String((datatableColumnOn("company")?1:0)+(datatableColumnOn("plate")?1:0)+(datatableColumnOn("shift")?1:0)+(datatableColumnOn("actor")?1:0));table.classList.toggle("is-overview",overview);const headRow=table.querySelector(".dt-head");if(headRow)table.style.setProperty("--dt-columns",String(Math.max(1,headRow.children.length-1)))
}
function bindDatatableViewportWatcher(){
  const mode=datatableIsMobile()?"mobile":"desktop";datatableState.viewportMode=mode;if(datatableState.viewportBound)return;datatableState.viewportBound=true;
  window.addEventListener("resize",()=>{clearTimeout(datatableState.viewportTimer);datatableState.viewportTimer=setTimeout(()=>{if(state.view!=="datatable")return;const next=datatableIsMobile()?"mobile":"desktop";if(next===datatableState.viewportMode)return;datatableState.viewportMode=next;if(next==="mobile"&&!document.fullscreenElement){datatableState.immersive=false;datatableState.nativeFullscreen=false;$("appView")?.classList.remove("datatable-fullscreen-shell");document.body.classList.remove("datatable-fullscreen-active")}renderDatatableRows(datatableState.data?.items||[])},140)})
}

function datatableActionPolicy(row,status=row.currentStatus){
  const stage=datatableState.stage,role=state.user?.accessRights||"";
  const none={type:"none",label:""};
  if(stage==="total")return none;
  if(stage==="gate_to_document")return status==="WAITING_DOCUMENT_SUBMISSION"?{type:"track",label:"ติดตาม"}:none;
  if(stage==="document_review"){
    if(status!=="WAITING_DOCUMENT_CHECK")return none;
    return role==="ADMIN"?{type:"document_check",label:"ตรวจเอกสารเสร็จ"}:{type:"track",label:"ติดตาม"};
  }
  if(stage==="ready")return status==="READY_FOR_RECEIVING"?{type:"ready",label:"จัดการคิว"}:none;
  if(stage==="receiving")return status==="RECEIVING_IN_PROGRESS"?{type:"receiving",label:"จัดการรับสินค้า"}:none;
  if(stage==="document_return")return ["WAITING_DOCUMENT_RETURN","REJECTED_WAITING_DOCUMENT_RETURN"].includes(status)?{type:"track",label:"ติดตาม"}:none;
  if(stage==="gate_out")return ["WAITING_GATE_OUT","REJECTED_WAITING_GATE_OUT"].includes(status)?{type:"track",label:"ติดตาม"}:none;
  if(stage==="overview"){
    if(status==="WAITING_DOCUMENT_SUBMISSION")return{type:"track",label:"ติดตาม"};
    if(status==="WAITING_DOCUMENT_CHECK")return role==="ADMIN"?{type:"document_check",label:"ตรวจเอกสารเสร็จ"}:{type:"track",label:"ติดตาม"};
    if(status==="READY_FOR_RECEIVING")return{type:"ready",label:"จัดการคิว"};
    if(status==="RECEIVING_IN_PROGRESS")return{type:"receiving",label:"จัดการรับสินค้า"};
    if(["WAITING_DOCUMENT_RETURN","WAITING_GATE_OUT","REJECTED_WAITING_DOCUMENT_RETURN","REJECTED_WAITING_GATE_OUT"].includes(status))return{type:"track",label:"ติดตาม"};
    return none;
  }
  return none;
}
function datatableCommandLabel(row){return datatableActionPolicy(row,row.currentStatus).label}
async function runDatatableCommand(autoId,sourceButton=null){
  const row=datatableState.data?.items?.find(item=>String(item.autoId)===String(autoId));if(!row||datatableState.detailBusy)return;
  const original=sourceButton?.textContent||"";if(sourceButton){sourceButton.disabled=true;sourceButton.textContent="กำลังตรวจสอบ"}
  try{
    datatableState.detailBusy=true;
    const context=await api(`/api/datatable/action-context?autoId=${encodeURIComponent(autoId)}`),vehicle=datatableInternalVehicle(context.vehicle||{});
    state.activeDoors=(context.activeDoors||[]).map(code=>String(code||"").toUpperCase());state.queueRecall=context.queueRecall||state.queueRecall;state.documentCheckEnabled=Boolean(context.documentCheckEnabled);
    const index=state.vehicles.findIndex(v=>String(v.auto_id)===String(autoId));if(index>=0)state.vehicles[index]=vehicle;else state.vehicles.unshift(vehicle);
    const policy=datatableActionPolicy(row,vehicle.current_status);
    if(policy.type==="exclude")return await showExcludeVehicle(vehicle);
    if(policy.type==="document_check")return await confirmDocumentChecked(vehicle);
    if(policy.type==="ready")return await showDatatableReadyActions(vehicle);
    if(policy.type==="receiving")return await showDatatableReceivingActions(vehicle);
    if(policy.type==="track")return await openDatatableTrack(autoId);
    datatableState.detailBusy=false;
    if(sourceButton?.isConnected){sourceButton.disabled=false;sourceButton.textContent=original}
    return await showDatatableDetail(autoId,sourceButton);
  }catch(error){await showNotice("error",error.message||"ไม่สามารถดำเนินการรายการนี้ได้")}
  finally{datatableState.detailBusy=false;if(sourceButton?.isConnected){sourceButton.disabled=false;sourceButton.textContent=original}}
}

async function runDatatableExclude(autoId,sourceButton=null){
  if(datatableState.detailBusy)return;const original=sourceButton?.textContent||"";if(sourceButton){sourceButton.disabled=true;sourceButton.textContent="กำลังตรวจ"}datatableState.detailBusy=true;
  try{const context=await api(`/api/datatable/action-context?autoId=${encodeURIComponent(autoId)}`),vehicle=datatableInternalVehicle(context.vehicle||{});return await showExcludeVehicle(vehicle)}catch(error){await showNotice("error",error.message||"ไม่สามารถตรวจสอบรายการนี้ได้")}finally{datatableState.detailBusy=false;if(sourceButton?.isConnected){sourceButton.disabled=false;sourceButton.textContent=original}}
}
async function showExcludeVehicle(vehicle){
  if(!window.Swal)return;const missing=missingAppointmentValue(vehicle?.appointment_no),validation=vehicle?.appointmentValidation||appointmentValidationClient(vehicle?.appointment_no),appointment=missing?"ว่าง / 0":String(vehicle?.appointment_no||""),defaultReason=missing?"MISSING_APPOINTMENT":(validation?.enabled&&!validation.valid?"DATA_ENTRY_ERROR":""),defaultNote=validation?.enabled&&!validation.valid&&!missing?String(validation.message||""):"";
  const result=await Swal.fire({title:"นำรายการออก",html:`<div class="vehicle-exclude-form"><div class="vehicle-exclude-summary"><small>รายการที่เลือก</small><b>${escapeHtml(appointment)}</b><span>${escapeHtml(vehicle.company_name||"ไม่ระบุบริษัท")} · ${escapeHtml(joinText(vehicle.vehicle_plate,vehicle.province)||"ไม่ระบุทะเบียน")}</span><em>Auto ID ${escapeHtml(vehicle.auto_id||"")}</em></div><label><span>เหตุผล</span><select id="vehicleExcludeReason"><option value="" ${defaultReason?"":"selected"} disabled>เลือกเหตุผล</option><option value="MISSING_APPOINTMENT" ${defaultReason==="MISSING_APPOINTMENT"?"selected":""}>เลขนัดหมายว่าง / เป็น 0</option><option value="DUPLICATE">ข้อมูลซ้ำ</option><option value="WRONG_GATE_IN">Gate In ผิดรายการ</option><option value="DATA_ENTRY_ERROR">กรอกข้อมูลผิด</option><option value="NOT_DELIVERY">ไม่ใช่รถส่งสินค้า</option><option value="OTHER">อื่น ๆ</option></select></label><label><span>หมายเหตุเพิ่มเติม</span><textarea id="vehicleExcludeNote" maxlength="500" rows="3" placeholder="ระบุรายละเอียดเพิ่มเติมเมื่อจำเป็น">${escapeHtml(defaultNote)}</textarea></label><div class="vehicle-exclude-note"><b>หลังยืนยัน</b><span>รายการจะไม่นำไปใช้ในงานรับสินค้า Inbound Datatable และ Dashboard และระบบจะกันไม่ให้กลับมาจากการรับข้อมูลรอบถัดไป จนกว่าจะคืนรายการ</span></div></div>`,showCancelButton:true,confirmButtonText:"นำรายการออก",cancelButtonText:"ยกเลิก",focusCancel:true,customClass:{...swalClasses(),popup:"wfv-swal vehicle-exclude-swal",confirmButton:"wfv-swal-confirm vehicle-exclude-confirm"},buttonsStyling:false,width:520,preConfirm:()=>{const reasonCode=document.getElementById("vehicleExcludeReason")?.value||"",reasonNote=document.getElementById("vehicleExcludeNote")?.value.trim()||"";if(!reasonCode){Swal.showValidationMessage("กรุณาเลือกเหตุผล");return false}if(reasonCode==="OTHER"&&!reasonNote){Swal.showValidationMessage("กรุณาระบุเหตุผลเพิ่มเติม");return false}return{reasonCode,reasonNote}}});
  if(!result.isConfirmed||!result.value)return;
  try{Swal.fire({title:"กำลังนำรายการออก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:380});const data=await api("/api/vehicles/exclude",{method:"POST",body:{autoId:vehicle.auto_id,...result.value}});state.vehicles=state.vehicles.filter(item=>String(item.auto_id)!==String(vehicle.auto_id));if(datatableState.data?.items)datatableState.data.items=datatableState.data.items.filter(item=>String(item.autoId)!==String(vehicle.auto_id));await Swal.fire({icon:"success",title:"นำรายการออกแล้ว",text:data.message||"รายการถูกนำออกจากงานแล้ว",timer:1900,showConfirmButton:false,customClass:swalClasses(),width:430});await loadDatatable(true)}catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message||"นำรายการออกไม่สำเร็จ")}
}
function vehicleExclusionCard(item){const s=item.snapshot||{},plate=joinText(s.vehiclePlate,s.province)||"ไม่ระบุทะเบียน",company=s.companyName||"ไม่ระบุบริษัท";return`<article class="vehicle-exclusion-card"><header><div><small>Auto ID</small><b>${escapeHtml(item.autoId||"")}</b></div><span>${escapeHtml(item.reasonLabel||"นำออกจากระบบ")}</span></header><div class="vehicle-exclusion-grid"><div><small>บริษัท</small><b>${escapeHtml(company)}</b></div><div><small>ทะเบียนรถ</small><b>${escapeHtml(plate)}</b></div><div><small>Gate In</small><b>${escapeHtml(formatDate(s.gateInAt))}</b></div><div><small>นำออกโดย</small><b>${escapeHtml(item.excludedBy||"ระบบ")}</b></div></div>${item.reasonNote?`<p>${escapeHtml(item.reasonNote)}</p>`:""}<footer><time>${escapeHtml(formatDate(item.excludedAt))}</time>${item.canRestore?`<button type="button" data-exclusion-restore="${escapeHtml(item.autoId||"")}">คืนรายการ</button>`:""}</footer></article>`}
async function showVehicleExclusions(){
  if(!window.Swal)return;try{Swal.fire({title:"กำลังโหลดรายการ",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:380});const data=await api("/api/vehicles/exclusions"),items=data.items||[],html=data.setupRequired?`<div class="empty-state"><b>ยังไม่ได้เตรียมฐานข้อมูล</b><span>กรุณาให้ Admin รันไฟล์ SQL ของรอบนี้ก่อน</span></div>`:items.length?`<div class="vehicle-exclusion-list">${items.map(vehicleExclusionCard).join("")}</div>`:`<div class="empty-state"><b>ยังไม่มีรายการที่นำออก</b><span>รายการ Gate In ที่นำออกจะมาแสดงที่นี่</span></div>`;await Swal.fire({title:"รายการที่นำออก",html,confirmButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal vehicle-exclusions-swal"},buttonsStyling:false,width:760,didOpen:()=>document.querySelectorAll("[data-exclusion-restore]").forEach(button=>button.addEventListener("click",()=>{const autoId=button.dataset.exclusionRestore;Swal.close();restoreVehicleExclusion(autoId)}))})}catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message||"โหลดรายการที่นำออกไม่สำเร็จ")}
}
async function restoreVehicleExclusion(autoId){
  if(!window.Swal)return;const confirm=await Swal.fire({icon:"question",title:"คืนรายการนี้หรือไม่",text:"หลังคืน ระบบจะนำข้อมูลกลับเมื่อรับข้อมูล Gate รอบถัดไป",showCancelButton:true,confirmButtonText:"คืนรายการ",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:450});if(!confirm.isConfirmed)return;try{Swal.fire({title:"กำลังคืนรายการ",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:360});const data=await api("/api/vehicles/exclusions/restore",{method:"POST",body:{autoId}});await Swal.fire({icon:"success",title:"คืนรายการแล้ว",text:data.message||"รอรับข้อมูล Gate รอบถัดไป",timer:2000,showConfirmButton:false,customClass:swalClasses(),width:430});await showVehicleExclusions()}catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message||"คืนรายการไม่สำเร็จ")}
}

async function showDatatableReadyActions(vehicle){if(!window.Swal)return;const called=Number(vehicle.queue_called_at||0)>0,buttons=[[called?"recall":"call",called?"เรียกซ้ำ / เปลี่ยนประตู":"เรียกรถ","queue"],["start","เริ่มตรวจรับ","start"],["reject","ปฏิเสธรับสินค้า","danger"],["track","ติดตามสถานะ","track"]];return Swal.fire({title:"พร้อมตรวจรับ",html:`<div class="dt-action-context"><small>เลขนัดหมาย</small><b>${escapeHtml(vehicle.appointment_no||vehicle.auto_id)}</b><span>${escapeHtml(vehicle.company_name||"-")}${vehicle.door_code?` · ประตู ${escapeHtml(vehicle.door_code)}`:""}</span></div><div class="dt-action-menu">${buttons.map(([key,label,tone])=>`<button type="button" class="dt-action-${tone}" data-dt-action="${key}">${escapeHtml(label)}</button>`).join("")}</div>`,showConfirmButton:false,showCancelButton:true,cancelButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal dt-action-swal dt-action-ready-swal"},buttonsStyling:false,width:440,didOpen:()=>document.querySelectorAll("[data-dt-action]").forEach(btn=>btn.addEventListener("click",()=>{Swal.close();const action=btn.dataset.dtAction;if(action==="call")callVehicle(vehicle,false);else if(action==="recall")callVehicle(vehicle,true);else if(action==="start")startReceiving(vehicle);else if(action==="reject")rejectReceiving(vehicle);else if(action==="track")openDatatableTrack(vehicle.auto_id)}))})}
async function showDatatableReceivingActions(vehicle){if(!window.Swal)return;const buttons=[["complete","รับสินค้าเสร็จ","complete"],["reject","ปฏิเสธรับสินค้า","danger"],["track","ติดตามสถานะ","track"]];return Swal.fire({title:"กำลังตรวจรับสินค้า",html:`<div class="dt-action-context"><small>เลขนัดหมาย</small><b>${escapeHtml(vehicle.appointment_no||vehicle.auto_id)}</b><span>${escapeHtml(vehicle.company_name||"-")}${vehicle.door_code?` · ประตู ${escapeHtml(vehicle.door_code)}`:""}</span></div><div class="dt-action-menu">${buttons.map(([key,label,tone])=>`<button type="button" class="dt-action-${tone}" data-dt-action="${key}">${escapeHtml(label)}</button>`).join("")}</div>`,showConfirmButton:false,showCancelButton:true,cancelButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal dt-action-swal dt-action-receiving-swal"},buttonsStyling:false,width:440,didOpen:()=>document.querySelectorAll("[data-dt-action]").forEach(btn=>btn.addEventListener("click",()=>{Swal.close();const action=btn.dataset.dtAction;if(action==="complete")completeReceiving(vehicle);else if(action==="reject")rejectReceiving(vehicle);else if(action==="track")openDatatableTrack(vehicle.auto_id)}))})}
async function openDatatableTrack(autoId){try{const result=await api("/api/track/link",{method:"POST",body:{search:autoId}}),token=String(result?.token||"").trim();if(!token)throw new Error("ไม่สามารถสร้างลิงก์ Track ได้");window.open(new URL(`./track.html?t=${encodeURIComponent(token)}&v=20260813-r97`,location.href).href,"_blank","noopener")}catch(error){await showNotice("error",error.message||"เปิด Track ไม่สำเร็จ")}}
function formatDatatableBusinessDate(value){
  const key=String(value||"").slice(0,10),m=key.match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:(value?String(value):"-")
}
function datatableDetailShiftMeta(vehicle){
  const shifts=datatableState.meta?.shifts||[],shift=shifts.find(item=>String(item.shift_id||"")===String(vehicle?.shiftId||vehicle?.shift_id||""))||shifts.find(item=>String(item.shift_name||"")===String(vehicle?.shiftName||""));
  if(!shift)return{cross:false,range:""};const start=Number(shift.start_minute),end=Number(shift.end_minute);return{cross:start>=end,range:Number.isFinite(start)&&Number.isFinite(end)?`${minuteToTime(start)}–${minuteToTime(end)}`:""}
}
async function showDatatableDetail(autoId,sourceButton=null){
  if(datatableState.detailBusy)return;
  const original=sourceButton?.textContent||"";if(sourceButton){sourceButton.disabled=true;sourceButton.textContent="กำลังเปิด"}
  datatableState.detailBusy=true;uiState.detailsOpen=true;
  try{
    if(window.Swal)Swal.fire({title:"กำลังเปิดข้อมูล",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:380});
    const data=await api(`/api/datatable/detail?autoId=${encodeURIComponent(autoId)}`),v=data.vehicle||{},events=data.events||[],d=data.durations||{},rej=data.rejection,shiftMeta=datatableDetailShiftMeta(v);
    const stages=[
      ["gate_to_document","รถเข้า → ยื่นเอกสาร",d.gateToDocumentSeconds],
      ["document_review","ตรวจเอกสาร",d.documentReviewSeconds],
      ["ready","รอตรวจรับ",d.readyToReceivingSeconds],
      ["queue","เรียก → เริ่มตรวจรับ",d.calledToReceivingSeconds],
      ["receiving","ตรวจรับสินค้า",d.receivingSeconds],
      ["document_return","คืนเอกสาร",d.receivingToReturnSeconds],
      ["gate_out","ออกจากพื้นที่",d.returnToGateOutSeconds],
      ["total","เวลารวม",d.totalInSiteSeconds]
    ];
    const businessDate=formatDatatableBusinessDate(v.shiftBusinessDate),statusText=statusLabel(v.currentStatus),plate=joinText(v.vehiclePlate,v.province),company=v.companyName||"ไม่ระบุบริษัท",appointment=v.appointmentNo||v.autoId||autoId;
    const metaItems=[
      v.shiftName?`<div><small>กะ</small><b>${escapeHtml(v.shiftName)}</b>${shiftMeta.range?`<span>${escapeHtml(shiftMeta.range)}${shiftMeta.cross?" · ข้ามวัน":""}</span>`:""}</div>`:"",
      v.shiftBusinessDate?`<div><small>วันที่เริ่มกะ</small><b>${escapeHtml(businessDate)}</b></div>`:"",
      v.doorCode?`<div><small>ประตู</small><b>${escapeHtml(v.doorCode)}</b></div>`:"",
      v.driverName?`<div><small>คนขับ</small><b>${escapeHtml(v.driverName)}</b></div>`:""
    ].filter(Boolean).join("");
    const eventRows=events.map((e,index)=>`<div class="dt-detail-history-row${index===events.length-1?" is-latest":""}"><time>${formatDate(e.occurred_at)}</time><b>${datatableEventLabel(e.event_type)}</b><span>${escapeHtml(e.actor||"ระบบ")}</span></div>`).join("");
    const html=`<div class="dt-detail-modal dt-detail-modal-r116">
      <section class="dt-detail-summary-r116">
        <div class="dt-detail-key"><small>เลขนัดหมาย</small><b>${escapeHtml(appointment)}${datatableAppointmentBadge(v)}</b>${v.appointmentValidation?.enabled&&!v.appointmentValidation.valid?`<em class="dt-detail-appointment-warning">${escapeHtml(v.appointmentValidation.message||"เลขนัดหมายไม่ถูกต้อง")}</em>`:""}<span>${escapeHtml(company)}</span></div>
        <div class="dt-detail-key"><small>ทะเบียนรถ</small><b>${escapeHtml(plate||"-")}</b><span class="dt-detail-status ${statusTone(v.currentStatus)}">${escapeHtml(statusText)}</span></div>
      </section>
      ${metaItems?`<section class="dt-detail-meta-r116">${metaItems}</section>`:""}
      <section class="dt-detail-time-r116"><header><b>เวลาของแต่ละช่วงงาน</b></header><div>${stages.map(([key,label,value])=>`<article class="stage-${escapeHtml(key)} ${value==null?"is-empty":""}"><small>${escapeHtml(label)}</small><b>${value==null?"—":formatDuration(value)}</b></article>`).join("")}</div></section>
      ${rej?`<section class="dt-rejection-r116"><b>ปฏิเสธรับสินค้า</b><span>เหตุผล ${escapeHtml(rej.reason||"-")}</span><span>ผู้รับทราบ ${escapeHtml(rej.supervisor||"-")}</span><span>${Number(rej.require_document_return)?"ต้องรับเอกสารคืน":"ไม่ต้องรับเอกสารคืน"}</span></section>`:""}
      <section class="dt-detail-history-r116"><header><b>ประวัติการทำงาน</b><span>${events.length.toLocaleString("th-TH")} รายการ</span></header><div class="dt-detail-history-grid">${eventRows||`<div class="dt-detail-no-history">ยังไม่มีประวัติการทำงาน</div>`}</div></section>
    </div>`;
    if(window.Swal){const canExclude=datatableCanRequestExclusion(v,v.currentStatus),detailResult=await Swal.fire({title:"ข้อมูลนัดหมาย",html,confirmButtonText:"ปิด",showDenyButton:canExclude,denyButtonText:"นำรายการออก",customClass:{...swalClasses(),popup:"wfv-swal dt-detail-swal dt-detail-swal-r116",confirmButton:"wfv-swal-confirm dt-detail-close-r116",denyButton:"dt-detail-exclude-button"},buttonsStyling:false,width:1040,allowOutsideClick:false});if(detailResult.isDenied)return await showExcludeVehicle(datatableInternalVehicle(v))}
  }catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message||"เปิดข้อมูลไม่สำเร็จ")}
  finally{datatableState.detailBusy=false;uiState.detailsOpen=false;if(sourceButton?.isConnected){sourceButton.disabled=false;sourceButton.textContent=original}}
}
async function downloadDatatableExport(){if(datatableState.busy)return;try{if(window.Swal)Swal.fire({title:"กำลังเตรียมไฟล์ Datatable",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:390});const data=await api(`/api/datatable/export?${datatableParams({page:false}).toString()}`),items=data.items||[],headers=["รหัสรถ (Auto ID)","เลขนัดหมาย","บริษัท","คนขับ","ทะเบียน","จังหวัด","สถานะ","กะ","วันที่เริ่มกะ","ประตู","รถเข้าพื้นที่","ยื่นเอกสาร","ตรวจเอกสารเสร็จ","เรียกครั้งแรก","เรียกล่าสุด","จำนวนเรียก","เริ่มตรวจรับ","รับสินค้าเสร็จ","ปฏิเสธรับสินค้า","เหตุผลปฏิเสธ","หัวหน้างานรับทราบ","คืนเอกสาร","ออกจากพื้นที่","รถเข้า→ยื่นเอกสาร (วินาที)","ตรวจเอกสาร (วินาที)","พร้อม→เริ่มตรวจรับ (วินาที)","เรียก→เริ่มตรวจรับ (วินาที)","ตรวจรับสินค้า (วินาที)","รอคืนเอกสาร (วินาที)","รอออกจากพื้นที่ (วินาที)","เวลารวม (วินาที)","เกณฑ์ช่วงที่เลือก","ระดับแจ้งเตือน","ผู้ดำเนินการช่วงที่เลือก"],rows=items.map(i=>[i.autoId,i.appointmentNo,i.companyName,i.driverName,i.vehiclePlate,i.province,statusLabel(i.currentStatus),i.shiftName,i.shiftBusinessDate||"",i.doorCode,formatDate(i.gateInAt),formatDate(i.documentSubmittedAt),formatDate(i.documentCheckedAt),formatDate(i.firstCalledAt),formatDate(i.lastCalledAt),i.queueCallCount,formatDate(i.receivingStartedAt),formatDate(i.receivingCompletedAt),formatDate(i.rejectedAt),i.rejectionReason,i.rejectionSupervisor,formatDate(i.documentReturnedAt),formatDate(i.gateOutAt),i.gateToDocumentSeconds,i.documentReviewSeconds,i.readyToReceivingSeconds,i.calledToReceivingSeconds,i.receivingSeconds,i.receivingToReturnSeconds,i.returnToGateOutSeconds,i.totalInSiteSeconds,i.stageRuleCode,alertLevelLabel(i.stageAlertLevel),i.stageActor]);const csv="\uFEFF"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`Datatable_${datatableState.from}_${datatableState.to}_${datatableState.stage}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);if(window.Swal)await Swal.fire({icon:"success",title:"สร้างไฟล์ Datatable แล้ว",text:`${items.length.toLocaleString("th-TH")} รายการ${data.truncated?" (จำกัด 5,000 รายการ)":""}`,timer:1800,showConfirmButton:false,customClass:swalClasses(),width:420})}catch(error){if(window.Swal)Swal.close();await showNotice("error",error.message||"ส่งออก Datatable ไม่สำเร็จ")}}

function renderDatatablePager(data){const el=$("dtPager");if(!el)return;const pages=Math.max(1,Number(data.pages||1)),page=Math.min(pages,Number(data.page||datatableState.page)),total=Number(data.total||0),from=total?(page-1)*Number(data.limit||datatableState.limit)+1:0,to=Math.min(total,page*Number(data.limit||datatableState.limit)),numbers=[];for(let i=Math.max(1,page-2);i<=Math.min(pages,page+2);i++)numbers.push(i);el.innerHTML=`<div><label>แสดง <select id="dtLimit"><option value="25">25</option><option value="50">50</option><option value="100">100</option></select> รายการ/หน้า</label><span>${from}-${to} จาก ${total.toLocaleString("th-TH")} รายการ</span></div><nav><button data-dt-page="${Math.max(1,page-1)}" ${page<=1?"disabled":""}>‹</button>${numbers.map(n=>`<button data-dt-page="${n}" class="${n===page?"active":""}">${n}</button>`).join("")}<button data-dt-page="${Math.min(pages,page+1)}" ${page>=pages?"disabled":""}>›</button></nav>`;$("dtLimit").value=String(datatableState.limit);$("dtLimit")?.addEventListener("change",()=>{datatableState.limit=Number($("dtLimit").value)||25;datatableState.page=1;loadDatatable(true)})}

function datatableSelectedShift(){return(datatableState.meta?.shifts||[]).find(item=>String(item.shift_id)===String(datatableState.shiftId))||null}

function datatableDateAdd(key,days){const [y,m,d]=String(key||"").split("-").map(Number),date=new Date(Date.UTC(y,m-1,d+days));return`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`}

function datatableLocalMinute(){const parts=new Intl.DateTimeFormat("en-GB",{timeZone:cfg.timezone,hour:"2-digit",minute:"2-digit",hour12:false}).formatToParts(new Date()),p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return Number(p.hour)*60+Number(p.minute)}

function adjustDatatableDateForCrossDayShift(){const shift=datatableSelectedShift(),today=datatableDateKey(),minute=datatableLocalMinute(),needsPrevious=shift&&Number(shift.start_minute)>=Number(shift.end_minute)&&minute<Number(shift.end_minute);if(needsPrevious&&datatableState.from===today&&datatableState.to===today){const previous=datatableDateAdd(today,-1);datatableState.from=previous;datatableState.to=previous;datatableState.shiftAutoDate=true;if($("dtFrom"))$("dtFrom").value=previous;if($("dtTo"))$("dtTo").value=previous;return}if(datatableState.shiftAutoDate&&!needsPrevious){datatableState.from=today;datatableState.to=today;datatableState.shiftAutoDate=false;if($("dtFrom"))$("dtFrom").value=today;if($("dtTo"))$("dtTo").value=today}}

function syncDatatableShiftHint(context=null){const el=$("dtShiftHint"),shift=context||datatableSelectedShift();if(!el)return;if(!shift){el.hidden=true;el.textContent="";return}const start=Number(shift.startMinute??shift.start_minute),end=Number(shift.endMinute??shift.end_minute),cross=shift.crossesMidnight??start>=end;el.hidden=false;el.textContent=cross?`${shift.shiftName||shift.shift_name} ${minuteToTime(start)}–${minuteToTime(end)} · กะข้ามวัน ระบบนับตามวันที่เริ่มกะ`:`${shift.shiftName||shift.shift_name} ${minuteToTime(start)}–${minuteToTime(end)} · สิ้นสุดในวันเดียวกัน`}

function syncDatatableDateLabels(){const selected=Boolean(datatableState.shiftId),from=$("dtFromLabel"),to=$("dtToLabel");if(from)from.textContent=selected?"วันที่เริ่มกะ (จาก)":"วันที่เริ่ม";if(to)to.textContent=selected?"วันที่เริ่มกะ (ถึง)":"วันที่สิ้นสุด"}

function renderDatatableBusinessDateNote(context=null){const el=$("dtBusinessDateNote"),shift=context||datatableSelectedShift();if(!el)return;if(!shift){el.hidden=true;el.innerHTML="";return}const start=Number(shift.startMinute??shift.start_minute),end=Number(shift.endMinute??shift.end_minute),cross=shift.crossesMidnight??start>=end,from=datatableState.from,to=datatableState.to,dateText=from&&to?(from===to?from:`${from} ถึง ${to}`):"ตามวันที่ที่เลือก";if(!cross){el.hidden=false;el.innerHTML=`<b>การนับช่วงข้อมูล:</b> ใช้วันที่ ${escapeHtml(dateText)} และเวลาภายใน ${escapeHtml(shift.shiftName||shift.shift_name)} ${minuteToTime(start)}–${minuteToTime(end)}`;return}const nextDay=from?datatableDateAdd(from,1):"วันถัดไป",single=from&&to&&from===to;el.hidden=false;el.innerHTML=single?`<b>กะข้ามวัน:</b> ถ้าเลือกวันที่ <strong>${escapeHtml(from)}</strong> ระบบจะนับกะ <strong>${escapeHtml(shift.shiftName||shift.shift_name)}</strong> ตั้งแต่ <strong>${minuteToTime(start)}</strong> ของวันที่นี้ ไปจนถึง <strong>${minuteToTime(end)}</strong> ของวันที่ <strong>${escapeHtml(nextDay)}</strong>`:`<b>กะข้ามวัน:</b> ระบบนับตามวันที่เริ่มกะของแต่ละวันในช่วง <strong>${escapeHtml(dateText)}</strong> แม้เวลาสิ้นสุดจะอยู่วันถัดไป`;}

function toggleDatatableMobileFilters(force){const page=document.querySelector(".dt-page");datatableState.mobileFiltersOpen=typeof force==="boolean"?force:!datatableState.mobileFiltersOpen;if(page)page.classList.toggle("dt-mobile-filters-open",datatableState.mobileFiltersOpen);const button=$("dtMobileFilterToggle");if(button)button.classList.toggle("is-active",datatableState.mobileFiltersOpen);}

function datatableCurrentRuleCode(){const meta=datatableStageMeta(),codes=meta.ruleCodes||[];if(datatableState.stage==="ready"&&codes.length>1)return datatableState.meta?.documentCheckEnabled?"DOCUMENT_CHECKED_TO_RECEIVING_START":"DOCUMENT_TO_RECEIVING_START";return codes[0]||"TOTAL_IN_SITE"}

function renderDatatableSide(){const name=$("dtRuleStageName"),levels=$("dtCurrentRules"),banner=$("dtCurrentRuleBanner"),meta=datatableStageMeta(),code=datatableCurrentRuleCode(),rules=(datatableState.meta?.rules||[]).filter(rule=>rule.stage_code===code),order=["NORMAL","WATCH","WARNING","URGENT","CRITICAL"];if(name)name.textContent=meta.label||"ภาพรวม";if(banner)banner.style.setProperty("--dt-stage-accent",datatableStageAccentColor(datatableState.stage));if(levels)levels.innerHTML=order.map(level=>{const rule=rules.find(item=>item.level_code===level);return rule?`<span style="--dt-rule:${safeColor(rule.color)}"><i></i><b>${alertLevelLabel(level)}</b><em>${Math.round(Number(rule.start_seconds||0)/60)} นาที</em></span>`:""}).join("")||`<small>ยังไม่ได้ตั้งเกณฑ์เวลา</small>`}

function datatableRuleLabel(code){return({GATE_TO_DOCUMENT:"รถเข้า → ยื่นเอกสาร",DOCUMENT_REVIEW:"ตรวจเอกสาร",DOCUMENT_TO_RECEIVING_START:"รอตรวจรับ",DOCUMENT_CHECKED_TO_RECEIVING_START:"รอตรวจรับ",RECEIVING_DURATION:"ตรวจรับสินค้า",RECEIVING_TO_RETURN:"คืนเอกสาร",RETURN_TO_GATE_OUT:"ออกจากพื้นที่",TOTAL_IN_SITE:"เวลารวม"})[code]||code}

function renderDatatableRules(rules){const order=["NORMAL","WATCH","WARNING","URGENT","CRITICAL"],groups={};for(const rule of rules){(groups[rule.stage_code]??=[]).push(rule)}return Object.entries(groups).map(([code,items])=>`<article class="dt-rule-row"><b>${escapeHtml(datatableRuleLabel(code))}</b><div>${order.map(level=>{const r=items.find(x=>x.level_code===level);return r?`<span style="--dt-rule:${safeColor(r.color)}"><i></i><em>${alertLevelLabel(level)}</em><strong>${Math.round(Number(r.start_seconds||0)/60)} นาที</strong></span>`:""}).join("")}</div></article>`).join("")||`<div class="empty-state">ยังไม่ได้ตั้งเกณฑ์เวลา</div>`}

async function showDatatableAllRules(){if(!window.Swal)return;const doc=Boolean(datatableState.meta?.documentCheckEnabled),rules=(datatableState.meta?.rules||[]).filter(r=>doc?r.stage_code!=="DOCUMENT_TO_RECEIVING_START":!["DOCUMENT_REVIEW","DOCUMENT_CHECKED_TO_RECEIVING_START"].includes(r.stage_code));await Swal.fire({title:"เกณฑ์เวลาที่กำหนด",html:`<div class="dt-all-rules">${renderDatatableRules(rules)}</div>`,confirmButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal dt-rules-swal"},buttonsStyling:false,width:760})}

function renderDatatableActivity(items,generatedAt){datatableState.activity=(items||[]).filter(item=>["GATE_IN","DOCUMENT_SUBMITTED","DOCUMENT_CHECKED","RECEIVING_STARTED","RECEIVING_COMPLETED","RECEIVING_REJECTED","DOCUMENT_RETURNED","GATE_OUT"].includes(item.event_code)).slice(0,12);datatableState.activityGeneratedAt=generatedAt||0}

async function showDatatableActivity(){if(!window.Swal)return;const items=datatableState.activity||[],html=items.length?`<div class="dt-activity-modal">${items.map(item=>`<div><time>${formatDateShort(item.event_time)}</time><span><b>${datatableEventLabel(item.event_code)}</b><small>${escapeHtml(item.appointment_no||item.auto_id)} · ${escapeHtml(item.actor||"ระบบ")}</small></span></div>`).join("")}</div>`:`<div class="empty-state">ยังไม่มีกิจกรรมในข้อมูลที่เลือก</div>`;await Swal.fire({title:"กิจกรรมล่าสุดในช่วงที่เลือก",html,confirmButtonText:"ปิด",customClass:{...swalClasses(),popup:"wfv-swal"},buttonsStyling:false,width:560})}

function datatableEventLabel(code){return({GATE_IN:"รถเข้าพื้นที่",DOCUMENT_SUBMITTED:"ยื่นเอกสาร",DOCUMENT_CHECKED:"ตรวจเอกสารเสร็จ",RECEIVING_STARTED:"เริ่มตรวจรับสินค้า",RECEIVING_COMPLETED:"รับสินค้าเสร็จ",RECEIVING_REJECTED:"ปฏิเสธรับสินค้า",DOCUMENT_RETURNED:"คืนเอกสารแล้ว",GATE_OUT:"ออกจากพื้นที่"})[code]||code}

function runDatatableQuick(action){if(action==="critical"){datatableCommitFilterChange(()=>{datatableState.sla="CRITICAL";datatableState.problemOnly=false;datatableState.rejectedOnly=false;datatableState.invalidAppointmentOnly=false},{after:()=>{if($("dtSla"))$("dtSla").value="CRITICAL"}})}else if(action==="rejected"){datatableCommitFilterChange(()=>{datatableState.stage="overview";datatableState.rejectedOnly=true;datatableState.status="ALL";datatableState.sla="ALL";datatableState.problemOnly=false;datatableState.invalidAppointmentOnly=false},{after:()=>{document.querySelectorAll("[data-dt-stage]").forEach(b=>b.classList.toggle("active",b.dataset.dtStage==="overview"));if($("dtStatus"))$("dtStatus").value="ALL";if($("dtSla"))$("dtSla").value="ALL";renderDatatableSide()}})}else if(action==="receiving"){navigate("operations")}else if(action==="export")downloadDatatableExport()}

function datatableComparePreviousRange(from,to){
  const start=new Date(`${from}T00:00:00Z`),end=new Date(`${to}T00:00:00Z`),days=Math.max(1,Math.round((end-start)/86400000)+1),previousEnd=new Date(start.getTime()-86400000),previousStart=new Date(previousEnd.getTime()-(days-1)*86400000),key=date=>`${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}-${String(date.getUTCDate()).padStart(2,"0")}`;
  return{from:key(previousStart),to:key(previousEnd)}
}
function datatableCompareDimensionLabel(value){return({DATE:"วันที่",RANGE:"ช่วงวันที่",SHIFT:"กะ",DOOR:"ประตู",ACTOR:"ผู้ดำเนินการ",STAGE:"ช่วงงาน"})[value]||"วันที่"}
function datatableCompareStageOptions(selected){return(datatableState.meta?.stages||[]).filter(stage=>datatableState.meta?.documentCheckEnabled||stage.key!=="document_review").map(stage=>`<option value="${escapeHtml(stage.key)}" ${stage.key===selected?"selected":""}>${escapeHtml(stage.label)}</option>`).join("")}
function datatableCompareShiftOptions(selected){return`<option value="">ทุกกะ</option>${(datatableState.meta?.shifts||[]).map(item=>`<option value="${escapeHtml(item.shift_id)}" ${String(item.shift_id)===String(selected)?"selected":""}>${escapeHtml(item.shift_name)} · ${minuteToTime(item.start_minute)}–${minuteToTime(item.end_minute)}</option>`).join("")}`}
function datatableCompareDoorOptions(selected){return`<option value="">ทุกประตู</option>${(datatableState.meta?.doors||[]).map(item=>`<option value="${escapeHtml(item.door_code)}" ${String(item.door_code)===String(selected)?"selected":""}>${escapeHtml(item.door_code)}</option>`).join("")}`}
function datatableCompareActorOptions(selected){return`<option value="">ผู้ดำเนินการทั้งหมด</option>${(datatableState.meta?.actors||[]).map(item=>`<option value="${escapeHtml(item.name)}" ${String(item.name)===String(selected)?"selected":""}>${escapeHtml(item.name)}</option>`).join("")}`}
function datatableCompareIcon(name){const paths={date:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',range:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18M7 14h4M13 17h4"/>',shift:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',door:'<path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M6 21h12M15 12h.01"/>',actor:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',stage:'<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6V4h8v2M8 11h8M8 15h5"/>',vehicle:'<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',late:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',critical:'<path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v4M12 17h.01"/>',reject:'<circle cx="12" cy="12" r="9"/><path d="m7 7 10 10"/>',total:'<circle cx="12" cy="12" r="9"/><path d="M9 3h6M12 7v5l3 2"/>'};return`<svg class="dt-cmp-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]||paths.stage}</svg>`}
function datatableCompareInitialState(){
  const previous=datatableComparePreviousRange(datatableState.from,datatableState.to),base={shiftId:datatableState.shiftId||"",door:datatableState.door||"",actor:datatableState.actor||"",stage:datatableState.stage||"overview"};
  return{dimension:"DATE",busy:false,result:null,a:{...base,from:datatableState.from,to:datatableState.to},b:{...base,from:previous.from,to:previous.to},common:{stage:datatableState.stage||"overview",status:datatableState.status||"ALL",sla:datatableState.sla||"ALL"}}
}
function datatableCompareDatasetPrimary(compare,setKey){
  const set=compare[setKey],dimension=compare.dimension;
  if(dimension==="SHIFT")return`<label class="dt-compare-primary"><span>กะที่เปรียบเทียบ</span><select data-cmp-field="${setKey}.shiftId">${datatableCompareShiftOptions(set.shiftId)}</select></label>`;
  if(dimension==="DOOR")return`<label class="dt-compare-primary"><span>ประตูที่เปรียบเทียบ</span><select data-cmp-field="${setKey}.door">${datatableCompareDoorOptions(set.door)}</select></label>`;
  if(dimension==="ACTOR")return`<label class="dt-compare-primary"><span>ผู้ดำเนินการที่เปรียบเทียบ</span><select data-cmp-field="${setKey}.actor">${datatableCompareActorOptions(set.actor)}</select></label>`;
  if(dimension==="STAGE")return`<label class="dt-compare-primary"><span>ช่วงงานที่เปรียบเทียบ</span><select data-cmp-field="${setKey}.stage">${datatableCompareStageOptions(set.stage)}</select></label>`;
  return""
}
function datatableCompareDatasetHtml(compare,setKey,label,tone){
  const set=compare[setKey],singleDate=compare.dimension==="DATE",shiftDimension=compare.dimension==="SHIFT",dateFromLabel=shiftDimension?"วันที่เริ่มกะ (จาก)":(singleDate?"วันที่":"วันที่เริ่ม"),dateToLabel=shiftDimension?"วันที่เริ่มกะ (ถึง)":"วันที่สิ้นสุด",shiftControl=shiftDimension?"":`<label><span>กะ</span><select data-cmp-field="${setKey}.shiftId">${datatableCompareShiftOptions(set.shiftId)}</select></label>`,optional=(["DATE","RANGE"].includes(compare.dimension)?`<div class="dt-compare-set-secondary"><label><span>ประตู</span><select data-cmp-field="${setKey}.door">${datatableCompareDoorOptions(set.door)}</select></label><label><span>ผู้ดำเนินการ</span><select data-cmp-field="${setKey}.actor">${datatableCompareActorOptions(set.actor)}</select></label></div>`:"");
  return`<section class="dt-compare-set ${tone}"><header><span>${label}</span><div><b>ชุดข้อมูล ${label}</b><small>${label==="A"?"ข้อมูลอ้างอิง":"ข้อมูลที่นำมาเปรียบเทียบ"}</small></div></header><div class="dt-compare-date-grid ${singleDate?"is-single":""}"><label><span>${dateFromLabel}</span><input type="date" data-cmp-field="${setKey}.from" value="${escapeHtml(set.from)}"></label>${singleDate?"":`<label><span>${dateToLabel}</span><input type="date" data-cmp-field="${setKey}.to" value="${escapeHtml(set.to)}"></label>`}</div>${shiftControl}${datatableCompareDatasetPrimary(compare,setKey)}${optional}</section>`
}
function datatableCompareMetricCard(label,unit,key,a,b,difference,kind="count"){
  const format=value=>kind==="average"?datatableCompareMinuteClock(value):kind==="duration"?datatableCompareHourClock(value):Number(value||0).toLocaleString("th-TH"),deltaValue=Number(difference?.[key]||0),percentKey=key.replace(/Count$/,"Percent").replace("avgSeconds","avgPercent").replace("totalSeconds","totalPercent").replace("vehicleCount","vehiclePercent"),percent=difference?.[percentKey],badHigher=["avgSeconds","lateCount","criticalCount","rejectedCount","totalSeconds"].includes(key),tone=deltaValue===0?"neutral":badHigher?(deltaValue>0?"bad":"good"):"neutral",deltaText=kind==="average"?datatableCompareSignedMinuteClock(deltaValue):kind==="duration"?datatableCompareSignedHourClock(deltaValue):`${deltaValue>0?"+":""}${deltaValue.toLocaleString("th-TH")}`,percentText=percent==null?"":` · ${percent>0?"+":""}${Number(percent).toFixed(1)}%`,icon=({vehicleCount:"vehicle",avgSeconds:"clock",lateCount:"late",criticalCount:"critical",rejectedCount:"reject",totalSeconds:"total"})[key]||"stage";
  return`<article class="dt-compare-metric ${tone}"><header><span class="dt-cmp-metric-icon">${datatableCompareIcon(icon)}</span><div><b>${label}</b><small>${unit}</small></div></header><div class="dt-compare-ab"><div><span>A</span><strong>${format(a?.[key])}</strong></div><div><span>B</span><strong>${format(b?.[key])}</strong></div></div><footer><span>ผลต่าง</span><b>${deltaText}${percentText}</b></footer></article>`
}
function datatableCompareMinuteClock(seconds){const value=Math.max(0,Math.round(Number(seconds)||0)),minutes=Math.floor(value/60),secs=value%60;return`${minutes}:${String(secs).padStart(2,"0")}`}
function datatableCompareHourClock(seconds){const value=Math.max(0,Math.round(Number(seconds)||0)),hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60);return`${hours}:${String(minutes).padStart(2,"0")}`}
function datatableCompareSignedMinuteClock(seconds){const value=Math.round(Number(seconds)||0),sign=value>0?"+":value<0?"−":"",abs=Math.abs(value);return`${sign}${Math.floor(abs/60)}:${String(abs%60).padStart(2,"0")}`}
function datatableCompareSignedHourClock(seconds){const value=Math.round(Number(seconds)||0),sign=value>0?"+":value<0?"−":"",abs=Math.abs(value);return`${sign}${Math.floor(abs/3600)}:${String(Math.floor(abs%3600/60)).padStart(2,"0")}`}
function datatableCompareSummary(result){
  if(!result)return"";const a=result.a||{},b=result.b||{},items=[];
  const avgDiff=Number(b.avgSeconds||0)-Number(a.avgSeconds||0);if(avgDiff!==0)items.push(`<li class="${avgDiff>0?"bad":"good"}"><b>${avgDiff>0?"ชุด B ใช้เวลาเฉลี่ยมากกว่า A":"ชุด B ใช้เวลาเฉลี่ยน้อยกว่า A"}</b><span>${datatableCompareMinuteClock(Math.abs(avgDiff))} นาที:วินาที</span></li>`);
  const lateDiff=Number(b.lateCount||0)-Number(a.lateCount||0);if(lateDiff!==0)items.push(`<li class="${lateDiff>0?"bad":"good"}"><b>${lateDiff>0?"ชุด B มีรายการล่าช้ามากกว่า A":"ชุด B มีรายการล่าช้าน้อยกว่า A"}</b><span>${Math.abs(lateDiff).toLocaleString("th-TH")} รายการ</span></li>`);
  const criticalDiff=Number(b.criticalCount||0)-Number(a.criticalCount||0);if(criticalDiff!==0)items.push(`<li class="${criticalDiff>0?"bad":"good"}"><b>${criticalDiff>0?"ชุด B มีรายการวิกฤตมากกว่า A":"ชุด B มีรายการวิกฤตน้อยกว่า A"}</b><span>${Math.abs(criticalDiff).toLocaleString("th-TH")} รายการ</span></li>`);
  if(!items.length)items.push(`<li class="neutral"><b>ผลลัพธ์หลักใกล้เคียงกัน</b><span>ไม่พบความต่างเด่นในข้อมูลที่เลือก</span></li>`);
  return`<section class="dt-compare-summary"><header>สรุปผลการเปรียบเทียบ</header><ul>${items.slice(0,3).join("")}</ul></section>`
}
function datatableCompareResultsHtml(result){
  if(!result)return`<section class="dt-compare-result-empty"><b>พร้อมเปรียบเทียบ</b><span>เลือกชุดข้อมูล A และ B แล้วกด “เปรียบเทียบ” เพื่อดูผลลัพธ์</span></section>`;
  const a=result.a||{},b=result.b||{},d=result.difference||{};
  return`<section class="dt-compare-results"><header class="dt-compare-section-title"><b>ผลการเปรียบเทียบ</b><span>เปรียบเทียบค่า A และ B พร้อมผลต่างในหน่วยเดียวกัน</span></header><div class="dt-compare-metrics">${datatableCompareMetricCard("จำนวนรถ","คัน","vehicleCount",a,b,d)}${datatableCompareMetricCard("เวลาเฉลี่ย","นาที:วินาที","avgSeconds",a,b,d,"average")}${datatableCompareMetricCard("ล่าช้า","รายการ","lateCount",a,b,d)}${datatableCompareMetricCard("วิกฤต","รายการ","criticalCount",a,b,d)}${datatableCompareMetricCard("ปฏิเสธรับสินค้า","รายการ","rejectedCount",a,b,d)}${datatableCompareMetricCard("เวลารวม","ชม.:นาที","totalSeconds",a,b,d,"duration")}</div>${datatableCompareSummary(result)}</section>`
}
function datatableCompareHtml(compare){
  const dimensions=[["DATE","วันที่","date"],["RANGE","ช่วงวันที่","range"],["SHIFT","กะ","shift"],["DOOR","ประตู","door"],["ACTOR","ผู้ดำเนินการ","actor"],["STAGE","ช่วงงาน","stage"]],stageDisabled=compare.dimension==="STAGE";
  return`<div class="dt-compare-popup dt-compare-popup-v112"><section class="dt-compare-toolbar"><section class="dt-compare-dimensions"><header class="dt-compare-section-title"><b>มิติการเปรียบเทียบ</b></header><div>${dimensions.map(([key,label,icon])=>`<button type="button" data-cmp-dimension="${key}" class="${compare.dimension===key?"active":""}">${datatableCompareIcon(icon)}<span>${label}</span></button>`).join("")}</div></section><section class="dt-compare-common-wrap"><header class="dt-compare-section-title"><b>ตัวกรองร่วม</b></header><div class="dt-compare-common"><label><span>ช่วงงาน</span><select id="cmpCommonStage" ${stageDisabled?"disabled":""}>${datatableCompareStageOptions(compare.common.stage)}</select></label><label><span>สถานะ</span><select id="cmpCommonStatus"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE" ${compare.common.status==="ACTIVE"?"selected":""}>ระหว่างดำเนินการ</option><option value="CLOSED" ${compare.common.status==="CLOSED"?"selected":""}>เสร็จสิ้น</option><option value="REJECTED" ${compare.common.status==="REJECTED"?"selected":""}>ปฏิเสธรับสินค้า</option>${Object.entries(DATATABLE_STATUS_OPTIONS).filter(([key])=>key!=="CLOSED").map(([key,label])=>`<option value="${key}" ${compare.common.status===key?"selected":""}>${escapeHtml(label)}</option>`).join("")}</select></label><label><span>ระดับแจ้งเตือน</span><select id="cmpCommonSla"><option value="ALL">ทุกระดับ</option>${["NORMAL","WATCH","WARNING","URGENT","CRITICAL"].map(level=>`<option value="${level}" ${compare.common.sla===level?"selected":""}>${alertLevelLabel(level)}</option>`).join("")}</select></label></div></section></section><section class="dt-compare-data-section"><header class="dt-compare-section-title"><b>ชุดข้อมูลที่ต้องการเทียบ</b></header><div class="dt-compare-sets">${datatableCompareDatasetHtml(compare,"a","A","tone-a")}${datatableCompareDatasetHtml(compare,"b","B","tone-b")}</div></section><section class="dt-compare-output"><div id="dtCompareResults">${datatableCompareResultsHtml(compare.result)}</div></section><footer class="dt-compare-footer"><button type="button" id="cmpRun" class="primary">${datatableCompareIcon("stage")}<span>เปรียบเทียบ</span></button><button type="button" id="cmpReset" class="outline-button">ล้างค่า</button><button type="button" id="cmpClose" class="quiet-button">ปิด</button></footer></div>`
}
function datatableCompareSyncFromDom(compare){
  document.querySelectorAll("[data-cmp-field]").forEach(input=>{const [setKey,key]=input.dataset.cmpField.split(".");if(!compare[setKey])return;compare[setKey][key]=input.value;if(key==="from"&&compare.dimension==="DATE")compare[setKey].to=input.value});
  if($("cmpCommonStage")&&!$("cmpCommonStage").disabled)compare.common.stage=$("cmpCommonStage").value;if($("cmpCommonStatus"))compare.common.status=$("cmpCommonStatus").value;if($("cmpCommonSla"))compare.common.sla=$("cmpCommonSla").value
}
function datatableCompareApplyDimensionDefaults(compare,nextDimension){
  datatableCompareSyncFromDom(compare);compare.dimension=nextDimension;compare.result=null;
  if(nextDimension==="DATE"){compare.a.to=compare.a.from;compare.b.to=compare.b.from}
  if(nextDimension==="SHIFT"){const shifts=datatableState.meta?.shifts||[];if(!compare.a.shiftId&&shifts[0])compare.a.shiftId=shifts[0].shift_id;if(!compare.b.shiftId&&shifts[0])compare.b.shiftId=shifts[0].shift_id;if(compare.a.shiftId===compare.b.shiftId){const other=shifts.find(item=>String(item.shift_id)!==String(compare.a.shiftId));if(other)compare.b.shiftId=other.shift_id}}
  if(nextDimension==="DOOR"){const doors=datatableState.meta?.doors||[];if(!compare.a.door&&doors[0])compare.a.door=doors[0].door_code;if(!compare.b.door&&doors[0])compare.b.door=doors[0].door_code;if(compare.a.door===compare.b.door){const other=doors.find(item=>String(item.door_code)!==String(compare.a.door));if(other)compare.b.door=other.door_code}}
  if(nextDimension==="ACTOR"){const actors=datatableState.meta?.actors||[];if(!compare.a.actor&&actors[0])compare.a.actor=actors[0].name;if(!compare.b.actor&&actors[0])compare.b.actor=actors[0].name;if(compare.a.actor===compare.b.actor){const other=actors.find(item=>String(item.name)!==String(compare.a.actor));if(other)compare.b.actor=other.name}}
  if(nextDimension==="STAGE"){const stages=(datatableState.meta?.stages||[]).filter(stage=>datatableState.meta?.documentCheckEnabled||stage.key!=="document_review");compare.a.stage=compare.a.stage||stages[0]?.key||"overview";if(compare.b.stage===compare.a.stage)compare.b.stage=stages.find(stage=>stage.key!==compare.a.stage)?.key||compare.a.stage}
}
function datatableCompareBind(compare){
  document.querySelectorAll("[data-cmp-dimension]").forEach(button=>button.addEventListener("click",()=>{datatableCompareApplyDimensionDefaults(compare,button.dataset.cmpDimension);datatableCompareRender(compare)}));
  document.querySelectorAll("[data-cmp-field]").forEach(input=>input.addEventListener("change",()=>datatableCompareSyncFromDom(compare)));
  $("cmpCommonStage")?.addEventListener("change",()=>compare.common.stage=$("cmpCommonStage").value);$("cmpCommonStatus")?.addEventListener("change",()=>compare.common.status=$("cmpCommonStatus").value);$("cmpCommonSla")?.addEventListener("change",()=>compare.common.sla=$("cmpCommonSla").value);
  $("cmpRun")?.addEventListener("click",()=>runDatatableCompare(compare));$("cmpReset")?.addEventListener("click",()=>{const fresh=datatableCompareInitialState();Object.assign(compare,fresh);datatableCompareRender(compare)});$("cmpClose")?.addEventListener("click",()=>Swal.close())
}
function datatableCompareRender(compare){const root=$("dtCompareRoot");if(!root)return;root.innerHTML=datatableCompareHtml(compare);datatableCompareBind(compare)}
function datatableComparePayload(compare){
  datatableCompareSyncFromDom(compare);const a={...compare.a},b={...compare.b};if(compare.dimension==="DATE"){a.to=a.from;b.to=b.from}if(compare.dimension!=="STAGE"){a.stage=compare.common.stage;b.stage=compare.common.stage}
  return{dimension:compare.dimension,common:{stage:compare.common.stage,status:compare.common.status,sla:compare.common.sla},a,b}
}
async function runDatatableCompare(compare){
  if(compare.busy)return;datatableCompareSyncFromDom(compare);const resultBox=$("dtCompareResults"),inlineError=message=>{if(resultBox)resultBox.innerHTML=`<section class="dt-compare-result-empty error-state"><b>กรุณาตรวจสอบข้อมูล</b><span>${escapeHtml(message)}</span></section>`};
  if(!compare.a.from||!compare.b.from){inlineError("กรุณาเลือกวันที่ของชุดข้อมูล A และ B");return}
  if(compare.dimension==="SHIFT"&&(!compare.a.shiftId||!compare.b.shiftId)){inlineError("กรุณาเลือกกะของชุดข้อมูล A และ B");return}if(compare.dimension==="DOOR"&&(!compare.a.door||!compare.b.door)){inlineError("กรุณาเลือกประตูของชุดข้อมูล A และ B");return}if(compare.dimension==="ACTOR"&&(!compare.a.actor||!compare.b.actor)){inlineError("กรุณาเลือกผู้ดำเนินการของชุดข้อมูล A และ B");return}
  compare.busy=true;const button=$("cmpRun");if(button){button.disabled=true;button.textContent="กำลังเปรียบเทียบ"}if(resultBox)resultBox.innerHTML=`<section class="dt-compare-result-empty loading-state"><b>กำลังประมวลผล</b><span>กำลังเปรียบเทียบชุดข้อมูล A และ B</span></section>`;
  try{compare.result=await api("/api/datatable/compare",{method:"POST",body:datatableComparePayload(compare)});if($("dtCompareRoot")){$("dtCompareResults").innerHTML=datatableCompareResultsHtml(compare.result)}}catch(error){if(resultBox)resultBox.innerHTML=`<section class="dt-compare-result-empty error-state"><b>เปรียบเทียบไม่สำเร็จ</b><span>${escapeHtml(error.message||"กรุณาลองใหม่")}</span></section>`}finally{compare.busy=false;if(button?.isConnected){button.disabled=false;button.textContent="เปรียบเทียบ"}}
}
async function showDatatableCompare(){
  if(!window.Swal)return;const compare=datatableCompareInitialState();await Swal.fire({title:"เปรียบเทียบข้อมูล",html:`<div id="dtCompareRoot"></div>`,showConfirmButton:false,showCloseButton:true,allowOutsideClick:false,customClass:{...swalClasses(),popup:"wfv-swal dt-compare-swal",closeButton:"dt-compare-x"},buttonsStyling:false,width:1180,didOpen:()=>datatableCompareRender(compare)})
}

async function chooseDatatableColumns(){if(!window.Swal)return;const options=[["company","บริษัท"],["plate","ทะเบียนรถ"],["shift","กะ"],["actor","ผู้ดำเนินการ"]],html=`<div class="dt-column-chooser">${options.map(([key,label])=>`<label><input type="checkbox" data-dt-column="${key}" ${datatableColumnOn(key)?"checked":""}><span>${label}</span></label>`).join("")}</div>`;const result=await Swal.fire({title:"เลือกคอลัมน์ที่ต้องการแสดง",html,showCancelButton:true,confirmButtonText:"บันทึก",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:380,preConfirm:()=>[...document.querySelectorAll("[data-dt-column]:checked")].map(el=>el.dataset.dtColumn)});if(!result.isConfirmed)return;datatableState.columns=new Set(result.value||[]);localStorage.setItem("wvf_dt_columns_r96",JSON.stringify([...datatableState.columns]));renderDatatableRows(datatableState.data?.items||[])}

function datatableInternalVehicle(v){return{auto_id:v.autoId,appointment_no:v.appointmentNo,appointmentValidation:v.appointmentValidation||appointmentValidationClient(v.appointmentNo),company_name:v.companyName,driver_name:v.driverName,vehicle_plate:v.vehiclePlate,province:v.province,vehicle_type:v.vehicleType,current_status:v.currentStatus,door_code:v.doorCode,gate_in_at:v.gateInAt,document_submitted_at:v.documentSubmittedAt,document_checked_at:v.documentCheckedAt,receiving_started_at:v.receivingStartedAt,receiving_completed_at:v.receivingCompletedAt,document_returned_at:v.documentReturnedAt,rejected_at:v.rejectedAt,rejection_reason:v.rejectionReason,rejection_detail:v.rejectionDetail,rejection_supervisor:v.rejectionSupervisor,rejection_supervisor_position:v.rejectionSupervisorPosition,rejection_require_document_return:v.rejectionRequireDocumentReturn,use_document_check:v.useDocumentCheck,use_door:v.useDoor,require_door:v.requireDoor,queue_call_id:v.queueCallId,queue_call_type:v.queueCallType,queue_reason_code:v.queueReasonCode,queue_called_at:v.queueCalledAt,queue_call_count:v.queueCallCount,queue_previous_door_code:v.queuePreviousDoorCode}}

function renderDashboard() {
  if(!["ADMIN","USER"].includes(state.user?.accessRights))return navigate("inbound");
  $("pageContent").innerHTML=`<section class="opsdash-head r145-dashboard-head r146-dashboard-head r146-generated-head"><div class="opsdash-title"><button id="dashboardMenuButton" class="dashboard-menu-button" aria-label="เปิดเมนู" aria-expanded="false">☰</button><div class="r146-title-copy"><h2 id="dashboardPageTitle">ศูนย์ควบคุมการปฏิบัติงาน</h2><p>รับสินค้าและรถขนส่ง</p><small id="dashboardRangeLabel">กำลังโหลดข้อมูล</small></div></div><div class="opsdash-filter">${["ADMIN","USER"].includes(state.user?.accessRights)?`<button id="dashboardQueueButton" class="dashboard-queue-button" type="button" aria-label="เปิดจอคิว"><span aria-hidden="true">▣</span><b>จอคิว</b></button>`:""}<button id="dashboardCalendarButton" class="calendar-button" aria-label="เลือกวันที่"><span class="calendar-icon" aria-hidden="true"><i></i><i></i><strong>31</strong></span><b id="dashboardDateButtonLabel" data-mobile-label="วันที่">เลือกวันที่</b></button><div class="range-buttons"><button data-dashboard-range="today" data-mobile-label="1วัน" aria-label="แสดงข้อมูลรายวัน">วัน</button><button data-dashboard-range="7d" data-mobile-label="7วัน" aria-label="แสดงข้อมูล 7 วัน">7 วัน</button><button data-dashboard-range="30d" data-mobile-label="30วัน" aria-label="แสดงข้อมูล 30 วัน">30 วัน</button></div><select id="dashboardShift" aria-label="เลือกกะ"><option value="">ทุกกะ</option></select><div class="dashboard-theme-wrap"><button id="dashboardThemeButton" class="dashboard-theme-button" type="button" aria-label="เลือกสีหน้าจอ" aria-expanded="false"><i aria-hidden="true"></i><span>สี</span></button><div id="dashboardThemeMenu" class="dashboard-theme-menu" hidden>${dashboardThemeMenuHtml()}</div></div><button id="dashboardRefresh" class="outline-button dashboard-refresh-button" type="button">รีเฟรช</button><button id="dashboardFullscreen" class="outline-button">เต็มจอ</button><button id="dashboardMoreButton" class="dashboard-more-button" type="button" aria-label="ตัวเลือกเพิ่มเติม" aria-expanded="false">⋮</button></div><div id="dashboardMobileMenu" class="dashboard-mobile-menu" hidden>${["ADMIN","USER"].includes(state.user?.accessRights)?`<button id="dashboardMobileQueue" type="button"><b>▣</b><span>เปิดจอคิว</span></button>`:""}<button id="dashboardMobileTheme" type="button"><b>◐</b><span>สีหน้าจอ</span></button><button id="dashboardMobileRefresh" type="button"><b>↻</b><span>รีเฟรชข้อมูล</span></button><button id="dashboardMobileFullscreen" type="button"><b>⛶</b><span>เต็มจอ</span></button><button id="dashboardMobileInfo" type="button"><b>i</b><span>คำอธิบายข้อมูล</span></button></div></section><section id="dashboardCalendarPopover" class="dashboard-calendar-popover" hidden></section><div id="dashboardBody" class="loading">กำลังสรุปข้อมูล</div>`;
  document.querySelectorAll("[data-dashboard-range]").forEach(button=>button.addEventListener("click",()=>{closeDashboardMobileMenu();dashboardState.range=button.dataset.dashboardRange;dashboardState.lastLoadedAt=0;dashboardState.analyticsLastLoadedAt=0;syncDashboardRangeButtons();loadDashboard(true,true)}));
  if(!dashboardState.date)dashboardState.date=dashboardTodayKey();syncDashboardRangeButtons();
  $("dashboardMenuButton").addEventListener("click",toggleDashboardMenu);$("dashboardQueueButton")?.addEventListener("click",openPublicQueue);$("dashboardMobileQueue")?.addEventListener("click",()=>{closeDashboardMobileMenu();openPublicQueue()});$("dashboardFullscreen").addEventListener("click",toggleFullscreen);$("dashboardCalendarButton").addEventListener("click",()=>{closeDashboardMobileMenu();toggleDashboardCalendar()});$("dashboardRefresh")?.addEventListener("click",()=>{dashboardState.lastLoadedAt=0;dashboardState.analyticsLastLoadedAt=0;void loadDashboard(false,true)});$("dashboardThemeButton")?.addEventListener("click",event=>{event.stopPropagation();toggleDashboardThemeMenu()});document.querySelectorAll("[data-dashboard-theme]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();setDashboardTheme(button.dataset.dashboardTheme)}));$("dashboardMoreButton").addEventListener("click",toggleDashboardMobileMenu);$("dashboardMobileTheme")?.addEventListener("click",()=>{closeDashboardMobileMenu();showDashboardThemeDialog()});$("dashboardMobileRefresh")?.addEventListener("click",()=>{closeDashboardMobileMenu();dashboardState.lastLoadedAt=0;dashboardState.analyticsLastLoadedAt=0;void loadDashboard(false,true)});$("dashboardMobileFullscreen").addEventListener("click",()=>{closeDashboardMobileMenu();toggleFullscreen()});$("dashboardMobileInfo").addEventListener("click",()=>{closeDashboardMobileMenu();showDashboardInfo()});applyDashboardTheme();updateFullscreenButton();const restored=restoreDashboardSnapshot();loadDashboard(!restored);
}

function openPublicQueue(){window.open(new URL("./queue.html?v=20260811-r88",location.href).href,"_blank","noopener")}
async function showDashboardThemeDialog(){const result=await Swal.fire({title:"เลือกสีหน้าจอ",html:`<div class="dashboard-theme-dialog">${DASHBOARD_THEME_OPTIONS.map(item=>`<button type="button" data-dialog-theme="${item.id}" class="${normalizeDashboardTheme(dashboardState.theme)===item.id?"active":""}"><i class="theme-${item.id}"></i><span>${item.label}</span></button>`).join("")}</div>`,showConfirmButton:false,showCloseButton:true,customClass:swalClasses(),width:420,didOpen:()=>document.querySelectorAll("[data-dialog-theme]").forEach(button=>button.addEventListener("click",()=>{setDashboardTheme(button.dataset.dialogTheme);Swal.close()}))});return result}
function applyDashboardTheme(){const theme=normalizeDashboardTheme(dashboardState.theme),shell=$("appView");dashboardState.theme=theme;if(shell)shell.dataset.dashboardTheme=theme;document.querySelectorAll("[data-dashboard-theme]").forEach(button=>button.classList.toggle("active",button.dataset.dashboardTheme===theme));const button=$("dashboardThemeButton");if(button){button.dataset.activeTheme=theme;const label=button.querySelector("span");if(label)label.textContent="สี"}const mobileButton=$("dashboardMobileTheme");if(mobileButton){const span=mobileButton.querySelector("span");if(span)span.textContent="สีหน้าจอ"}}
function setDashboardTheme(theme){dashboardState.theme=normalizeDashboardTheme(theme);localStorage.setItem("wvf_dashboard_theme",dashboardState.theme);applyDashboardTheme();closeDashboardThemeMenu()}
function toggleDashboardThemeMenu(forceOpen=false){const menu=$("dashboardThemeMenu"),button=$("dashboardThemeButton");if(!menu||!button)return;const open=forceOpen||menu.hidden;menu.hidden=!open;button.setAttribute("aria-expanded",open?"true":"false");if(open)window.setTimeout(()=>document.addEventListener("click",closeDashboardThemeMenu,{once:true}),0)}
function closeDashboardThemeMenu(){const menu=$("dashboardThemeMenu"),button=$("dashboardThemeButton");if(menu)menu.hidden=true;if(button)button.setAttribute("aria-expanded","false")}

const DASHBOARD_SNAPSHOT_KEY="wvf_dashboard_snapshot_r146_visual_v2";
function dashboardSnapshotIdentity(range=dashboardState.range,date=dashboardState.date,shiftId=dashboardState.shiftId){return`${range||"today"}|${date||dashboardTodayKey()}|${shiftId||"ALL"}`}
function saveDashboardSnapshot(data,identity){try{const raw=sessionStorage.getItem(DASHBOARD_SNAPSHOT_KEY),existing=raw?JSON.parse(raw):null;if(existing?.identity===identity&&existing?.data?.analyticsReady&&!data?.analyticsReady)return;const clean={...data};delete clean.__localSnapshot;sessionStorage.setItem(DASHBOARD_SNAPSHOT_KEY,JSON.stringify({identity,savedAt:Date.now(),data:clean}))}catch{}}
function restoreDashboardSnapshot(){
  try{const raw=sessionStorage.getItem(DASHBOARD_SNAPSHOT_KEY);if(!raw)return false;const saved=JSON.parse(raw);if(!saved?.data||saved.identity!==dashboardSnapshotIdentity()||Date.now()-Number(saved.savedAt||0)>10*60*1000)return false;dashboardState.data={...saved.data,__localSnapshot:true};dashboardState.dataIdentity=saved.identity;dashboardState.lastLoadedAt=0;dashboardState.error="";dashboardState.analyticsError="";dashboardState.cacheState="LOCAL_SNAPSHOT";dashboardState.snapshotLoaded=true;renderDashboardData(dashboardState.data);return true}catch{return false}
}
function clearDashboardRetry(){if(dashboardState.retryTimer){clearTimeout(dashboardState.retryTimer);dashboardState.retryTimer=0}}
function scheduleDashboardRetry(){
  clearDashboardRetry();if(!navigator.onLine||state.view!=="dashboard")return;const delays=[5000,15000,30000,60000],delay=delays[Math.min(delays.length-1,Math.max(0,dashboardState.failures-1))];dashboardState.retryTimer=setTimeout(()=>{dashboardState.retryTimer=0;if(state.view==="dashboard"&&!dashboardState.busy)void loadDashboard(false,true)},delay)
}
function syncDashboardRangeButtons(){
  document.querySelectorAll("[data-dashboard-range]").forEach(button=>{const active=button.dataset.dashboardRange===dashboardState.range;button.classList.toggle("active",active);button.setAttribute("aria-pressed",active?"true":"false")});
}

function cancelDashboardRequest(){
  if(dashboardState.slowTimer){clearTimeout(dashboardState.slowTimer);dashboardState.slowTimer=0}
  clearDashboardRetry();
  if(dashboardState.requestController){try{dashboardState.requestController.abort()}catch{}dashboardState.requestController=null}
  if(dashboardState.analyticsController){try{dashboardState.analyticsController.abort()}catch{}dashboardState.analyticsController=null}
  dashboardState.busy=false;dashboardState.analyticsBusy=false;
}
function dashboardLoadingView(mode="loading"){
  const body=$("dashboardBody");if(!body)return;
  if(mode==="slow"){
    body.innerHTML=`<div class="dashboard-load-state is-slow"><span class="dashboard-load-spinner" aria-hidden="true"></span><b>กำลังสรุปข้อมูล</b><small>ใช้เวลานานกว่าปกติ ระบบกำลังเชื่อมต่ออีกครั้ง</small><button id="dashboardCancelRetry" class="outline-button" type="button">โหลดใหม่</button></div>`;
    $("dashboardCancelRetry")?.addEventListener("click",()=>{cancelDashboardRequest();loadDashboard(true,true)});
    return;
  }
  body.innerHTML=`<div class="dashboard-load-state"><span class="dashboard-load-spinner" aria-hidden="true"></span><b>กำลังสรุปข้อมูล</b><small>กำลังอ่านข้อมูลล่าสุด</small></div>`;
}
async function loadDashboard(showLoading=true,force=false){
  if(state.view!=="dashboard")return;
  const requestRange=dashboardState.range,requestDate=dashboardState.date||dashboardTodayKey(),requestShiftId=dashboardState.shiftId,requestIdentity=dashboardSnapshotIdentity(requestRange,requestDate,requestShiftId),hasMatchingData=Boolean(dashboardState.data&&dashboardState.dataIdentity===requestIdentity);
  if(dashboardState.busy){if(force)dashboardState.reloadRequested=true;return}
  if(!force&&hasMatchingData&&Date.now()-dashboardState.lastLoadedAt<12000){if(!dashboardState.data?.analyticsReady&&!dashboardState.analyticsBusy)void loadDashboardAnalytics(requestRange,requestDate,requestShiftId,requestIdentity);return}
  if(dashboardState.analyticsController){try{dashboardState.analyticsController.abort()}catch{}dashboardState.analyticsController=null;dashboardState.analyticsBusy=false}
  dashboardState.busy=true;
  const seq=++dashboardState.requestSeq;
  if(showLoading&&!hasMatchingData)dashboardLoadingView("loading");
  if(dashboardState.slowTimer)clearTimeout(dashboardState.slowTimer);
  dashboardState.slowTimer=setTimeout(()=>{if(state.view==="dashboard"&&dashboardState.busy&&seq===dashboardState.requestSeq&&!hasMatchingData)dashboardLoadingView("slow")},4500);
  const controller=new AbortController();dashboardState.requestController=controller;
  try{
    const query=`?range=${encodeURIComponent(requestRange)}&date=${encodeURIComponent(requestDate)}${requestShiftId?`&shiftId=${encodeURIComponent(requestShiftId)}`:""}`;
    const data=await api(`/api/dashboard/summary${query}`,{signal:controller.signal,timeoutMs:12000});
    if(seq!==dashboardState.requestSeq||state.view!=="dashboard")return;
    if(dashboardSnapshotIdentity()!==requestIdentity){dashboardState.reloadRequested=true;return}
    const displayData=mergeDashboardCoreData(data,dashboardState.dataIdentity===requestIdentity?dashboardState.data:null);dashboardState.data=displayData;dashboardState.dataIdentity=requestIdentity;dashboardState.date=data.selectedDate||requestDate;dashboardState.error="";dashboardState.analyticsError="";dashboardState.cacheState=String(data.dashboardCache?.state||"LIVE");dashboardState.lastLoadedAt=Date.now();dashboardState.failures=0;dashboardState.snapshotLoaded=false;clearDashboardRetry();saveDashboardSnapshot(displayData,requestIdentity);renderDashboardData(displayData);void loadDashboardAnalytics(requestRange,requestDate,requestShiftId,requestIdentity)
  }catch(error){
    if(seq!==dashboardState.requestSeq||state.view!=="dashboard"||controller.signal.aborted&&dashboardSnapshotIdentity()!==requestIdentity)return;
    if(dashboardSnapshotIdentity()!==requestIdentity){dashboardState.reloadRequested=true;return}
    dashboardState.failures+=1;dashboardState.error=error.message||"โหลดข้อมูลไม่สำเร็จ";dashboardState.cacheState=hasMatchingData?"LOCAL_FALLBACK":"ERROR";
    if(hasMatchingData){renderDashboardData(dashboardState.data);scheduleDashboardRetry()}
    else if($("dashboardBody")){
      $("dashboardBody").innerHTML=`<div class="dashboard-load-error"><b>โหลด Dashboard ไม่สำเร็จ</b><span>${escapeHtml(dashboardState.error)}</span><small>ระบบจะลองใหม่เป็นช่วง ๆ โดยไม่ยิงคำขอซ้ำถี่</small><div><button id="retryDashboard" class="primary" type="button">ลองใหม่</button><button id="dashboardBackOperations" class="outline-button" type="button">ไปหน้างานรับสินค้า</button></div></div>`;
      $("retryDashboard")?.addEventListener("click",()=>{dashboardState.failures=0;loadDashboard(true,true)});$("dashboardBackOperations")?.addEventListener("click",()=>navigate("operations"));scheduleDashboardRetry();
    }
  }finally{
    if(dashboardState.slowTimer){clearTimeout(dashboardState.slowTimer);dashboardState.slowTimer=0}
    if(dashboardState.requestController===controller)dashboardState.requestController=null;
    if(seq===dashboardState.requestSeq)dashboardState.busy=false;
    if(dashboardState.reloadRequested&&state.view==="dashboard"){dashboardState.reloadRequested=false;void loadDashboard(true,true)}
  }
}

function dashboardClientBottleneck(stageAverages,activeStages){const candidates=[{code:"GATE_TO_DOCUMENT",label:"รอยื่นเอกสาร",avg:Number(stageAverages?.gate_to_doc||0),queue:Number(activeStages?.WAITING_DOCUMENT_SUBMISSION||0)},{code:"DOCUMENT_REVIEW",label:"รอตรวจเอกสาร",avg:Number(stageAverages?.document_review||0),queue:Number(activeStages?.WAITING_DOCUMENT_CHECK||0)},{code:"DOCUMENT_CHECKED_TO_RECEIVING_START",label:"พร้อมตรวจรับ",avg:Number(stageAverages?.checked_to_start||stageAverages?.doc_to_start||0),queue:Number(activeStages?.READY_FOR_RECEIVING||0)},{code:"RECEIVING_DURATION",label:"กำลังตรวจรับ",avg:Number(stageAverages?.receiving||0),queue:Number(activeStages?.RECEIVING_IN_PROGRESS||0)},{code:"RECEIVING_TO_RETURN",label:"รอรับเอกสารคืน",avg:Number(stageAverages?.complete_to_return||0),queue:Number(activeStages?.WAITING_DOCUMENT_RETURN||0)},{code:"RETURN_TO_GATE_OUT",label:"รอออกจากพื้นที่",avg:Number(stageAverages?.return_to_out||0),queue:Number(activeStages?.WAITING_GATE_OUT||0)}];return candidates.sort((a,b)=>b.queue-a.queue||b.avg-a.avg)[0]||null}
function mergeDashboardCoreData(core,existing){if(!existing?.analyticsReady)return core;const merged={...existing,...core,metrics:{...(core.metrics||{}),p50TotalSeconds:existing.metrics?.p50TotalSeconds??core.metrics?.p50TotalSeconds??null,p90TotalSeconds:existing.metrics?.p90TotalSeconds??core.metrics?.p90TotalSeconds??null},workload:{...(core.workload||{}),handoverInStages:existing.workload?.handoverInStages||core.workload?.handoverInStages||{}},statuses:existing.statuses||[],shifts:existing.shifts||[],doors:existing.doors||[],shiftPerformance:existing.shiftPerformance||[],dataQuality:existing.dataQuality||{},stageAverages:existing.stageAverages||{},recent:existing.recent||[],cycleBands:existing.cycleBands||core.cycleBands||[],comparison:{...(existing.comparison||{}),...(core.comparison||{}),daily:existing.comparison?.daily||[],trendFrom:existing.comparison?.trendFrom??null,doorHeatmap:existing.comparison?.doorHeatmap||[],targetTotalSeconds:existing.comparison?.targetTotalSeconds??null},analyticsReady:true};merged.bottleneck=dashboardClientBottleneck(merged.stageAverages,merged.activeStages);return merged}
function mergeDashboardAnalytics(core,analytics){const merged={...core,metrics:{...(core.metrics||{}),...(analytics.metricsSupplement||{})},workload:{...(core.workload||{}),...(analytics.workloadSupplement||{})},statuses:analytics.statuses||[],shifts:analytics.shifts||[],doors:analytics.doors||[],shiftPerformance:analytics.shiftPerformance||[],dataQuality:analytics.dataQuality||{},stageAverages:analytics.stageAverages||{},recent:analytics.recent||[],cycleBands:analytics.cycleBands||core.cycleBands||[],comparison:{...(core.comparison||{}),...(analytics.comparison||{})},analyticsReady:true,analyticsGeneratedAt:analytics.generatedAt||null,analyticsCache:analytics.dashboardCache||null};merged.bottleneck=dashboardClientBottleneck(merged.stageAverages,merged.activeStages);return merged}
async function loadDashboardAnalytics(requestRange=dashboardState.range,requestDate=dashboardState.date,requestShiftId=dashboardState.shiftId,requestIdentity=dashboardSnapshotIdentity(requestRange,requestDate,requestShiftId),force=false){
  if(state.view!=="dashboard"||dashboardState.analyticsBusy)return;
  if(!force&&dashboardState.dataIdentity===requestIdentity&&dashboardState.data?.analyticsReady&&Date.now()-dashboardState.analyticsLastLoadedAt<30000)return;
  if(dashboardState.analyticsController){try{dashboardState.analyticsController.abort()}catch{}}
  const seq=++dashboardState.analyticsSeq,controller=new AbortController();dashboardState.analyticsController=controller;dashboardState.analyticsBusy=true;dashboardState.analyticsError="";
  try{const query=`?range=${encodeURIComponent(requestRange)}${requestDate?`&date=${encodeURIComponent(requestDate)}`:""}${requestShiftId?`&shiftId=${encodeURIComponent(requestShiftId)}`:""}`,analytics=await api(`/api/dashboard/analytics${query}`,{signal:controller.signal,timeoutMs:20000});if(seq!==dashboardState.analyticsSeq||state.view!=="dashboard"||dashboardState.dataIdentity!==requestIdentity||dashboardSnapshotIdentity()!==requestIdentity)return;const merged=mergeDashboardAnalytics(dashboardState.data||{},analytics);dashboardState.data=merged;dashboardState.analyticsError="";dashboardState.analyticsLastLoadedAt=Date.now();saveDashboardSnapshot(merged,requestIdentity);renderDashboardData(merged)}catch(error){if(seq!==dashboardState.analyticsSeq||state.view!=="dashboard"||controller.signal.aborted)return;dashboardState.analyticsError=error.message||"โหลดข้อมูลเพิ่มเติมไม่สำเร็จ";if(dashboardState.data)renderDashboardData(dashboardState.data)}finally{if(dashboardState.analyticsController===controller)dashboardState.analyticsController=null;if(seq===dashboardState.analyticsSeq)dashboardState.analyticsBusy=false}
}
function dashboardAnalyticsPending(){const failed=Boolean(dashboardState.analyticsError);return`<div class="dashboard-load-state ${failed?"is-slow":""}"><span class="dashboard-load-spinner" aria-hidden="true"></span><b>${failed?"ข้อมูลหน้านี้ยังไม่พร้อม":"กำลังเตรียมข้อมูลหน้านี้"}</b><small>${failed?"ข้อมูลหลักยังใช้งานได้ตามปกติ":"ข้อมูลหลักแสดงก่อน ส่วนที่เหลือจะตามมาอัตโนมัติ"}</small>${failed?`<button type="button" class="outline-button" data-dashboard-analytics-retry>ลองใหม่</button>`:""}</div>`}

function renderDashboardData(data){
  if(state.view!=="dashboard"||!$("dashboardBody"))return;syncDashboardRangeButtons();$("dashboardBody").classList.remove("loading");
  $("dashboardRangeLabel").textContent=`${formatDate(data.from)} – ${formatDate(data.to-1)} · อัปเดต ${formatDate(data.generatedAt)}`;
  const dashboardDateLabel=$("dashboardDateButtonLabel"),dashboardDateKey=data.selectedDate||dashboardState.date;if(dashboardDateLabel){dashboardDateLabel.textContent=formatDashboardDateKey(dashboardDateKey);dashboardDateLabel.dataset.mobileLabel=formatDashboardCompactDateKey(dashboardDateKey)}
  const shift=$("dashboardShift");if(shift){shift.innerHTML=`<option value="">ทุกกะ</option>${(data.shiftOptions||[]).map(item=>`<option value="${escapeHtml(item.shift_id)}">${escapeHtml(item.shift_name)} · ${minuteToTime(item.start_minute)}–${minuteToTime(item.end_minute)}</option>`).join("")}`;shift.value=dashboardState.shiftId;shift.onchange=()=>{closeDashboardMobileMenu();dashboardState.shiftId=shift.value;adjustDashboardDateForCrossDayShift(data.shiftOptions||[]);dashboardState.lastLoadedAt=0;dashboardState.analyticsLastLoadedAt=0;loadDashboard(true,true)}}
  const selectedKey=data.selectedDate||dashboardState.date,isHistory=selectedKey&&selectedKey!==dashboardTodayKey(),cacheState=String(dashboardState.cacheState||data.dashboardCache?.state||""),usingFallback=Boolean(data.__localSnapshot)||["LOCAL_SNAPSHOT","LOCAL_FALLBACK","STALE_REFRESHING","STALE_FALLBACK"].includes(cacheState),fresh=dashboardState.error||usingFallback?`<span class="opsdash-stale">● ใช้ข้อมูลล่าสุดที่มี · กำลังอัปเดต</span>`:isHistory?`<span class="opsdash-history">● ข้อมูลย้อนหลัง</span>`:`<span class="opsdash-live">● อัปเดตใกล้เวลาจริง</span>`;
  $("dashboardBody").innerHTML=`<section class="r146-command-strip">${dashboardDecisionRail(data)}${dashboardDataHealth(data,fresh)}</section>${dashboardAppointmentPlanHtml(data)}<section id="dashboardKpis" class="opsdash-kpis r145-kpis r146-kpis r146-generated-kpis">${dashboardKpiSet(data,dashboardState.tab)}</section><div id="dashboardTabContent" class="opsdash-content r145-content r146-content r146-generated-content">${dashboardTabContent(data)}</div><nav class="r146-bottom-tabs" aria-label="เลือกหน้า Dashboard">${dashboardTabs().map(([id,label])=>`<button data-dashboard-tab="${id}" class="${dashboardState.tab===id?"active":""}">${dashboardTabIcon(id)}<span>${label}</span></button>`).join("")}</nav>`;
  dashboardUpdatePageTitle();
  document.querySelectorAll("[data-dashboard-tab]").forEach(button=>button.addEventListener("click",()=>{dashboardState.tab=button.dataset.dashboardTab;renderDashboardTabOnly(dashboardState.data||data);if(!dashboardState.data?.analyticsReady&&dashboardState.tab!=="overview"&&!dashboardState.analyticsBusy)void loadDashboardAnalytics()}));
  $("dashboardTabContent")?.addEventListener("click",event=>{if(event.target.closest("[data-dashboard-analytics-retry]")&&!dashboardState.analyticsBusy){dashboardState.analyticsLastLoadedAt=0;void loadDashboardAnalytics(dashboardState.range,dashboardState.date,dashboardState.shiftId,dashboardSnapshotIdentity(),true)}});
}
function dashboardTabs(){return[["overview","ภาพรวม"],["handover","กะและส่งต่อ"],["comparison","เปรียบเทียบ"],["performance","ประสิทธิภาพเวลา"],["capacity","ประตู"],["exceptions","ข้อยกเว้น"]]}
function dashboardTabIcon(id){const icons={overview:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z"/></svg>`,handover:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h11l-3-3m3 3-3 3M17 17H6l3 3m-3-3 3-3"/></svg>`,comparison:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9m7 10V5m7 14v-7"/></svg>`,performance:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>`,capacity:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 21V4h14v17M8 8h3m2 0h3M8 12h3m2 0h3M8 16h3m2 0h3"/></svg>`,exceptions:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 22 20H2z"/><path d="M12 9v5m0 3h.01"/></svg>`};return icons[id]||""}
function dashboardPageTitle(tab=dashboardState.tab){return({overview:"ภาพรวมคลังสินค้า",handover:"งานค้างและส่งต่อ",comparison:"เทียบช่วงก่อน",performance:"เวลาทำงาน",capacity:"ประตู",exceptions:"จุดที่ต้องรีบแก้"})[tab]||"ภาพรวมคลังสินค้า"}
function dashboardUpdatePageTitle(){const title=$("dashboardPageTitle");if(title)title.textContent="ศูนย์ควบคุมการปฏิบัติงาน"}
function renderDashboardTabOnly(data){document.querySelectorAll("[data-dashboard-tab]").forEach(item=>item.classList.toggle("active",item.dataset.dashboardTab===dashboardState.tab));const kpis=$("dashboardKpis");if(kpis)kpis.innerHTML=dashboardKpiSet(data,dashboardState.tab);const content=$("dashboardTabContent");if(content)content.innerHTML=dashboardTabContent(data);dashboardUpdatePageTitle()}
function dashboardUrgentCount(data){const levels=data.alertLevels||{};return Number(data.metrics?.warningNow??(Number(levels.WARNING||0)+Number(levels.URGENT||0)+Number(levels.CRITICAL||0)))}
function dashboardQualityTotal(data){const q=data.dataQuality||{};return Number(q.missing_appointment||0)+Number(q.missing_plate||0)+Number(q.missing_shift||0)+Number(q.missing_required_door||0)}
function dashboardDoorStats(data){const rows=(data.doors||[]).filter(row=>String(row.label||"").trim()),used=rows.filter(row=>Number(row.total||0)>0),busiest=[...used].sort((a,b)=>Number(b.total||0)-Number(a.total||0))[0]||null,slowest=[...used].filter(row=>Number(row.avg_seconds||0)>0).sort((a,b)=>Number(b.avg_seconds||0)-Number(a.avg_seconds||0))[0]||null;return{used:used.length,busiest,slowest}}
function dashboardFlowMessage(data){const w=data.workload||{},diff=Number(w.gateOut||0)-Number(w.gateIn||0);if(diff>0)return`จบมากกว่ารถเข้า ${diff} คัน`;if(diff<0)return`รถเข้ามากกว่าจบ ${Math.abs(diff)} คัน`;return"รถเข้าและจบเท่ากัน"}
function dashboardDecisionRail(data){
  const w=data.workload||{},urgent=dashboardUrgentCount(data),b=data.bottleneck||dashboardClientBottleneck({},data.activeStages||{})||{},carryIn=Number(w.carryIn||0),carryOut=Number(w.carryOut||0),delta=carryOut-carryIn;
  const flowLabel=delta>0?`+${delta} คัน`:delta<0?`-${Math.abs(delta)} คัน`:`0 คัน`,flowNote=delta>0?"งานค้างเพิ่มจากต้นช่วง":delta<0?"งานค้างลดจากต้นช่วง":"งานค้างเท่าต้นช่วง",flowTone=delta>0?"warn":delta<0?"good":"neutral";
  return`<article class="r146-command-card ${urgent>0?"danger":"good"}"><i class="r146-command-symbol">!</i><div><small>ต้องเร่งจัดการ</small><b>${urgent} <em>คัน</em></b><span>${urgent?"มีรายการเกินระดับเตือน":"ยังไม่มีงานเกินเกณฑ์"}</span></div></article><article class="r146-command-card ${Number(b.queue||0)>0?"focus":"neutral"}"><i class="r146-command-symbol">▲</i><div><small>คอขวดวันนี้</small><b>${escapeHtml(b.label||"ไม่มีงานค้าง")}</b><span>${Number(b.queue||0)} คัน${Number(b.avg||0)>0?` · เฉลี่ย ${formatDuration(b.avg)}`:""}</span></div></article><article class="r146-command-card ${flowTone}"><i class="r146-command-symbol">↗</i><div><small>งานค้างเพิ่ม–ลด</small><b>${flowLabel}</b><span>${flowNote}</span></div></article>`
}
function dashboardDataHealth(data,fresh){const qTotal=dashboardQualityTotal(data),generated=Number(data.generatedAt||0),delay=Math.max(0,Math.floor(Date.now()/1000-generated)),delayText=!generated?"–":delay<60?"< 1 นาที":`${Math.ceil(delay/60)} นาที`,updated=generated?new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(generated*1000)):"–",quality=data.analyticsReady?(qTotal?`${qTotal} รายการ`:"ครบตามฟิลด์หลัก"):"กำลังตรวจ";return`<article class="r146-data-health"><div class="r146-health-fresh">${fresh}</div><div><small>คุณภาพข้อมูล</small><b>${quality}</b></div><div><small>อัปเดตล่าสุด</small><b>${updated}</b></div><div><small>ความล่าช้า</small><b>${delayText}</b></div></article>`}
function dashboardKpiSet(data,tab="overview"){const m=data.metrics||{},w=data.workload||{},a=data.activeStages||{},p=data.comparison?.previous||{},levels=data.alertLevels||{},qTotal=dashboardQualityTotal(data),doors=dashboardDoorStats(data),urgent=dashboardUrgentCount(data),rate=Number(m.total||0)?Number(m.closed||0)*100/Number(m.total||0):0,b=data.bottleneck||dashboardClientBottleneck({},a)||{};let specs=[];
  if(tab==="handover")specs=[["รับต่องาน",w.carryIn,"มีอยู่ก่อนเริ่มช่วง","#7C3AED","↙"],["รถเข้า",w.gateIn,"เข้าใหม่ในช่วง","#2563EB","↓"],["รถออก",w.gateOut,dashboardFlowMessage(data),"#059669","↗"],["ส่งต่อ",w.carryOut,"ยังไม่ Gate Out","#8B5CF6","▰"],["ระบายงานเก่า",w.priorPeriodClosed,"งานเดิมที่ปิดได้","#0F766E","✓"],["ต้องเร่ง",urgent,"เกินเกณฑ์หรือเสี่ยง","#DC2626","!"]];
  else if(tab==="comparison")specs=[["รถเข้า",w.gateIn,comparisonNote(w.gateIn,p.total,"ช่วงก่อน"),"#2563EB","↓"],["รถออก",w.gateOut,comparisonNote(w.gateOut,p.closed,"ช่วงก่อน"),"#059669","↗"],["คงอยู่",w.carryOut,"ปลายช่วงที่เลือก","#7C3AED","▰"],["เวลาเฉลี่ย",durationValue(m.avgTotalSeconds),comparisonNote(m.avgTotalSeconds,p.avgTotalSeconds,"ช่วงก่อน",true),"#0F766E","◷"],["P90",durationValue(m.p90TotalSeconds),"90% ของงานที่ปิด","#D97706","90"],["ต้องเร่ง",urgent,"รายการที่ต้องตาม","#DC2626","!"]];
  else if(tab==="performance")specs=[["เวลาเฉลี่ย",durationValue(m.avgTotalSeconds),"Gate In → Gate Out","#0F766E","◷"],["P50",durationValue(m.p50TotalSeconds),"ครึ่งหนึ่งจบภายใน","#2563EB","50"],["P90",durationValue(m.p90TotalSeconds),"จับงานที่ใช้เวลานาน","#D97706","90"],["ปิดงาน",`${Number(m.closed||0)}/${Number(m.total||0)}`,`${rate.toFixed(1)}% ของงานในช่วง`,"#059669","✓"],["รับเสร็จ",w.receivingCompleted,"ตรวจรับสินค้าเสร็จ","#0891B2","✓"],["คงอยู่",w.carryOut,"ยังไม่ Gate Out","#7C3AED","▰"]];
  else if(tab==="capacity")specs=[["ประตูมีงาน",doors.used,"ประตูที่มีรถในช่วง","#2563EB","▣"],["งานมากสุด",doors.busiest?.label||"–",doors.busiest?`${Number(doors.busiest.total||0)} คัน`:"ยังไม่มีข้อมูล","#059669","↑"],["ช้าที่สุด",doors.slowest?.label||"–",doors.slowest?`เฉลี่ย ${formatDuration(doors.slowest.avg_seconds)}`:"ยังไม่มีข้อมูล","#D97706","◷"],["ขาดข้อมูลประตู",Number(data.dataQuality?.missing_required_door||0),"รายการที่ต้องตรวจ","#DC2626","!"],["กำลังตรวจรับ",Number(a.RECEIVING_IN_PROGRESS||0),"กำลังใช้พื้นที่รับสินค้า","#0891B2","●"],["รถเข้า",w.gateIn,"ช่วงที่เลือก","#2563EB","↓"]];
  else if(tab==="exceptions")specs=[["วิกฤต",Number(levels.CRITICAL||0),"ต้องจัดการทันที","#DC2626","!"],["ล่าช้า",Number(levels.URGENT||0),"เกินเกณฑ์เวลา","#F97316","!"],["เตือน",Number(levels.WARNING||0),"ใกล้เกินเกณฑ์","#F59E0B","!"],["ข้อมูลไม่ครบ",qTotal,"ต้องตรวจแก้","#7C3AED","?"],["คอขวด",b.label||"ไม่มี",`${Number(b.queue||0)} คัน`,"#0F766E","▰"],["ต้องเร่งรวม",urgent,"เตือนขึ้นไป","#B91C1C","!"]];
  else specs=[["รถเข้า (สะสมวันนี้)",w.gateIn,comparisonNote(w.gateIn,p.total,"ช่วงก่อน"),"#2563EB","↓"],["รถออก (สะสมวันนี้)",w.gateOut,comparisonNote(w.gateOut,p.closed,"ช่วงก่อน"),"#059669","↗"],["รถในพื้นที่ (ค้างอยู่)",w.carryOut,`${Number(w.carryIn||0)} คันรับต่อจากก่อนช่วง`,"#7C3AED","▰"],["รับสินค้าเสร็จวันนี้",w.receivingCompleted,"จบขั้นตอนตรวจรับสินค้า","#0891B2","✓"],["เวลาเฉลี่ยทั้งหมด",durationValue(m.avgTotalSeconds),comparisonNote(m.avgTotalSeconds,p.avgTotalSeconds,"จากช่วงก่อน",true),"#0F766E","◷"],["P90 (ทั้งหมด)",durationValue(m.p90TotalSeconds),m.p90TotalSeconds==null?"กำลังคำนวณ":"90% ของงานที่ปิดใช้เวลาไม่เกินนี้","#D97706","90"]];
  return specs.map(([label,value,note,color,icon])=>dashboardKpi(label,value,note,color,icon)).join("")}
function dashboardKpi(label,value,note,color,icon=""){return`<article class="opsdash-kpi opsdash-kpi-static" style="--kpi-color:${color}"><div><small>${label}</small><b>${value??0}</b><span>${note||""}</span></div><i aria-hidden="true">${icon}</i></article>`}

function comparisonNote(current,previous,label,invert=false){const now=Number(current||0),before=Number(previous||0);if(before===0)return now===0?`<span class="opsdash-delta neutral">คงที่</span> ${label}`:`<span class="opsdash-delta neutral">เริ่มมีข้อมูล</span> ${label}`;const number=(now-before)*100/before,good=invert?number<=0:number>=0;return`<span class="opsdash-delta ${good?"good":"bad"}">${number>0?"+":""}${number.toFixed(1)}%</span> ${label}`}
function deltaNote(value,label,invert=false){const number=Number(value||0),good=invert?number<=0:number>=0;return`<span class="opsdash-delta ${good?"good":"bad"}">${number>0?"+":""}${number.toFixed(1)}%</span> ${label}`}
function dashboardHandoverTerms(data){
  const ctx=data?.shiftContext||{},selected=Boolean(ctx.selected&&ctx.shiftName),shiftName=selected?escapeHtml(ctx.shiftName):"";
  if(selected)return{selected,shiftName,flowTitle:"การรับและส่งต่องานระหว่างกะ",flowNote:`รับต่องานมา + รถเข้า (${shiftName}) = รถออก (${shiftName}) + ส่งต่อไป`,incomingShort:"รับต่องาน",gateInShort:"รถเข้า",gateOutShort:"รถออก",outgoingShort:"ส่งต่อ",outgoingKpiLabel:"ส่งต่อ",incomingNote:"รับต่องานมา",inheritedClosedNote:"งานรับต่อที่ปิดได้",responsibilityLabel:`รถที่รับผิดชอบใน ${shiftName} ทั้งหมด`,incomingPanelTitle:"งานที่รับต่อมา",incomingPanelNote:`มีอยู่ก่อนเริ่ม ${shiftName}`,outgoingPanelTitle:"งานที่ต้องส่งต่อไป",outgoingPanelNote:`ยังไม่ Gate Out เมื่อสิ้นสุด ${shiftName}`,resultNote:`ผลงานของ ${shiftName}`,sameClosedLabel:`เข้าและออกภายใน ${shiftName}`,inheritedClosedLabel:"งานรับต่อที่ปิดได้",receivingLabel:`ตรวจรับเสร็จใน ${shiftName}`,outgoingSummaryLabel:"ส่งต่อไปกะถัดไป",listTitle:"รายการรถที่ต้องส่งต่อไป",listNote:`ยังไม่ Gate Out เมื่อสิ้นสุด ${shiftName}`,queueTitle:"งานที่ต้องส่งต่อไป",queueNote:`สถานะเมื่อสิ้นสุด ${shiftName}`,agingNote:`นับจาก Gate In ถึงสิ้นสุด ${shiftName}`,metricGateInLabel:`รถเข้าใน ${shiftName}`};
  return{selected:false,shiftName:"",flowTitle:"การไหลของงานในช่วงที่เลือก",flowNote:"งานค้างก่อนช่วง + รถเข้าในช่วง = รถออกในช่วง + งานค้างปลายช่วง",incomingShort:"ค้างก่อนช่วง",gateInShort:"รถเข้า",gateOutShort:"รถออก",outgoingShort:"ค้างปลายช่วง",outgoingKpiLabel:"ค้างปลายช่วง",incomingNote:"ค้างก่อนช่วง",inheritedClosedNote:"งานค้างก่อนช่วงที่ปิดได้",responsibilityLabel:"รถในขอบเขตช่วงนี้ทั้งหมด",incomingPanelTitle:"งานค้างก่อนช่วง",incomingPanelNote:"มีอยู่ก่อนช่วงข้อมูลเริ่ม",outgoingPanelTitle:"งานค้างปลายช่วง",outgoingPanelNote:"ยังไม่ Gate Out เมื่อสิ้นสุดช่วง",resultNote:"ผลลัพธ์ของช่วงที่เลือก",sameClosedLabel:"เข้าและออกภายในช่วง",inheritedClosedLabel:"งานค้างก่อนช่วงที่ปิดได้",receivingLabel:"ตรวจรับเสร็จในช่วง",outgoingSummaryLabel:"คงค้างปลายช่วง",listTitle:"รายการรถที่ยังคงค้างปลายช่วง",listNote:"ยังไม่ Gate Out เมื่อสิ้นสุดช่วงข้อมูล",queueTitle:"งานค้างปลายช่วง",queueNote:"แยกตามสถานะเมื่อสิ้นสุดช่วง",agingNote:"นับจาก Gate In ถึงสิ้นสุดช่วงข้อมูล",metricGateInLabel:"รถเข้าในช่วง"};
}
function dashboardBars(rows){const max=Math.max(1,...rows.map(row=>Number(row.total)||0));return`<div class="dashboard-bars">${rows.map(row=>`<div><span>${escapeHtml(row.label||"ไม่ระบุ")}</span><i><em style="width:${Number(row.total)/max*100}%"></em></i><b>${Number(row.total)||0}</b></div>`).join("")||`<div class="empty-state">ไม่มีข้อมูล</div>`}</div>`}

function adjustDashboardDateForCrossDayShift(options){const selected=(options||[]).find(item=>String(item.shift_id)===String(dashboardState.shiftId)),today=dashboardTodayKey(),minute=datatableLocalMinute(),needsPrevious=selected&&Number(selected.start_minute)>=Number(selected.end_minute)&&minute<Number(selected.end_minute);if(needsPrevious&&dashboardState.date===today){dashboardState.date=datatableDateAdd(today,-1);dashboardState.shiftAutoDate=true;return}if(dashboardState.shiftAutoDate&&!needsPrevious){dashboardState.date=today;dashboardState.shiftAutoDate=false}}
function dashboardTabContent(data){if(["handover","comparison","performance","capacity","exceptions"].includes(dashboardState.tab)&&!data?.analyticsReady)return dashboardAnalyticsPending();if(dashboardState.tab==="handover")return dashboardHandover(data);if(dashboardState.tab==="comparison")return dashboardComparison(data);if(dashboardState.tab==="performance")return dashboardPerformance(data);if(dashboardState.tab==="capacity")return dashboardCapacity(data);if(dashboardState.tab==="exceptions")return dashboardExceptions(data);return dashboardOverview(data)}
function panel(title,note,body,className="",infoKey=""){return`<article class="opsdash-panel ${className}"><header><h3>${title}</h3>${note?`<div class="opsdash-panel-meta"><span>${note}</span></div>`:""}</header><div class="opsdash-panel-body">${body}</div></article>`}
function dashboardPanelInfoKey(title){if(/รถเข้าแต่ละชั่วโมง/.test(title))return"hourly";if(/งานค้าง|ขั้นตอน/.test(title))return"stageQueue";if(/อายุงานค้าง/.test(title))return"aging";if(/รีบ|ติดตาม|ส่งต่อ/.test(title))return"urgent";if(/สมดุล|งานค้างและส่งต่อ/.test(title))return"flow";if(/แนวโน้ม|เทียบ|ช่วงก่อน/.test(title))return"comparison";if(/ประตู|ความหนาแน่น|กะ/.test(title))return"capacity";if(/เตือน|คอขวด|ข้อมูล/.test(title))return"exceptions";return"performance"}
function dashboardOverview(data){const maxHour=Math.max(1,...(data.hours||[]).map(row=>Math.max(Number(row.total)||0,Number(row.gate_out)||0))),urgent=dashboardUrgentCount(data);return`<section class="r146-generated-overview">${panel("สถานะรถในแต่ละขั้นตอน","จำนวนรถที่ยังอยู่ในระบบ ณ เวลาปัจจุบัน",dashboardStageFlowBoard(data),"r146-stage-flow-board","stageQueue")}${panel("รถเข้า – ออก รายชั่วโมง","เห็นช่วงพีคของรถเข้าและจังหวะการระบายรถออก",hourlyInOutChart(data.hours||[],maxHour),"r146-hourly-board","hourly")}${panel("สัดส่วนสถานะรถค้าง",urgent?`${urgent} คันอยู่ในระดับเตือนขึ้นไป`:"ยังไม่มีรถเกินระดับเตือน",alertDonut(data.alertLevels),"r146-alert-board","exceptions")}${panel("จุดที่ต้องรีบดำเนินการ (Top 5)","เรียงจากระดับความเสี่ยงและเวลาค้าง",actionTable(data.actionItems,5),"r146-priority-table","urgent")}${panel("คอขวด (Bottleneck)","จุดที่มีงานค้างมากที่สุดในขณะนี้",dashboardBottleneckCard(data),"r146-bottleneck-board","exceptions")}${panel("สรุปกะและส่งต่องาน","ใช้ดูงานรับต่อ งานเข้า งานออก และงานที่จะส่งต่อ",dashboardShiftHandoverSummary(data),"r146-handover-board","handover")}</section>`}
function dashboardStageFlowBoard(data){const a=data.activeStages||{},avg=data.stageAverages||{},items=[{key:"WAITING_DOCUMENT_SUBMISSION",label:"รอยื่นเอกสาร",value:a.WAITING_DOCUMENT_SUBMISSION,avg:avg.gate_to_doc,color:"#2563EB"},{key:"WAITING_DOCUMENT_CHECK",label:"รอตรวจเอกสาร",value:a.WAITING_DOCUMENT_CHECK,avg:avg.document_review,color:"#10B981"},{key:"READY_FOR_RECEIVING",label:"พร้อมตรวจรับ",value:a.READY_FOR_RECEIVING,avg:avg.checked_to_start||avg.doc_to_start,color:"#7C3AED"},{key:"RECEIVING_IN_PROGRESS",label:"กำลังตรวจรับ",value:a.RECEIVING_IN_PROGRESS,avg:avg.receiving,color:"#0D9488"},{key:"WAITING_DOCUMENT_RETURN",label:"รอเอกสารคืน",value:a.WAITING_DOCUMENT_RETURN,avg:avg.complete_to_return,color:"#F59E0B"},{key:"WAITING_GATE_OUT",label:"รอออกจากพื้นที่",value:a.WAITING_GATE_OUT,avg:avg.return_to_out,color:"#EA580C"}],max=Math.max(0,...items.map(item=>Number(item.value||0)));return`<div class="r146-stage-pipeline">${items.map((item,index)=>`<div class="r146-stage-node ${max>0&&Number(item.value||0)===max?"is-bottleneck":""}" style="--stage:${item.color}"><small>${item.label}</small><b>${Number(item.value||0)}</b><span>${item.avg?`เฉลี่ย ${formatDuration(item.avg)}`:"ยังไม่มีค่าเฉลี่ย"}</span></div>${index<items.length-1?`<i class="r146-stage-arrow" aria-hidden="true">›</i>`:""}`).join("")}</div><div class="r146-stage-matrix"><span>คิวปัจจุบัน</span>${items.map(item=>`<b>${Number(item.value||0)}</b>`).join("")}<span>เวลาเฉลี่ย</span>${items.map(item=>`<b>${item.avg?formatDuration(item.avg):"–"}</b>`).join("")}</div>`}
function hourlyInOutChart(rows,maxValue){const max=Math.max(1,Number(maxValue)||1),byHour=new Map((rows||[]).map(row=>[Number(row.hour),row]));return`<div class="r146-hourly-legend"><span><i class="in"></i>รถเข้า</span><span><i class="out"></i>รถออก</span></div><div class="r146-hourly-chart">${Array.from({length:24},(_,hour)=>{const row=byHour.get(hour)||{},incoming=Number(row.total||0),outgoing=Number(row.gate_out||0),hi=incoming?Math.max(4,incoming/max*100):0,ho=outgoing?Math.max(4,outgoing/max*100):0;return`<div class="r146-hour-col" title="${String(hour).padStart(2,"0")}:00 · เข้า ${incoming} · ออก ${outgoing}"><b>${incoming||outgoing?`${incoming}/${outgoing}`:""}</b><span><i class="in" style="height:${hi}%"></i><i class="out" style="height:${ho}%"></i></span><small>${hour%3===0?String(hour).padStart(2,"0"):""}</small></div>`}).join("")}</div>`}
function dashboardBottleneckCard(data){const a=data.activeStages||{},b=data.bottleneck||dashboardClientBottleneck(data.stageAverages||{},a)||{},carry=Number(data.workload?.carryOut||0),share=carry?Math.round(Number(b.queue||0)*1000/carry)/10:0,rows=[["รอยื่นเอกสาร",a.WAITING_DOCUMENT_SUBMISSION],["รอตรวจเอกสาร",a.WAITING_DOCUMENT_CHECK],["พร้อมตรวจรับ",a.READY_FOR_RECEIVING],["กำลังตรวจรับ",a.RECEIVING_IN_PROGRESS],["รอเอกสารคืน",a.WAITING_DOCUMENT_RETURN],["รอออกจากพื้นที่",a.WAITING_GATE_OUT]].filter(([,value])=>Number(value||0)>0).sort((x,y)=>Number(y[1])-Number(x[1]));return`<div class="r146-bottleneck-main"><small>คอขวดหลักวันนี้</small><b>${escapeHtml(b.label||"ไม่มีงานค้าง")}</b><strong>${Number(b.queue||0)} <em>คัน</em></strong><span>${share?`${share}% ของรถที่ยังอยู่ในพื้นที่`:"ยังไม่มีงานค้าง"}${Number(b.avg||0)>0?` · เฉลี่ย ${formatDuration(b.avg)}`:""}</span></div><div class="r146-bottleneck-list">${rows.slice(0,4).map(([label,value],index)=>`<div class="${index===0?"active":""}"><span>${escapeHtml(label)}</span><i><em style="width:${Number(value)/Math.max(1,Number(rows[0]?.[1]||1))*100}%"></em></i><b>${Number(value)}</b></div>`).join("")||`<div class="empty-state">ไม่มีคิวงานค้าง</div>`}</div>`}
function dashboardShiftHandoverSummary(data){const w=data.workload||{},responsibility=Number(w.carryIn||0)+Number(w.gateIn||0),rate=responsibility?Math.min(100,Math.max(0,Number(w.gateOut||0)*100/responsibility)):0;return`<div class="r146-handover-numbers"><div><small>รับต่องานก่อน</small><b>${Number(w.carryIn||0)}</b><span>คัน</span></div><div><small>รถเข้า</small><b>${Number(w.gateIn||0)}</b><span>วันนี้</span></div><div><small>รถออก</small><b>${Number(w.gateOut||0)}</b><span>วันนี้</span></div><div><small>ส่งต่อกะถัดไป</small><b>${Number(w.carryOut||0)}</b><span>ปลายช่วง</span></div></div><div class="r146-handover-progress"><header><span>อัตราระบายงาน</span><b>${rate.toFixed(1)}%</b><em>${Number(w.gateOut||0)} / ${responsibility} คัน</em></header><i><em style="width:${rate}%"></em></i></div><div class="r146-handover-foot"><span><small>ปิดงานเก่า</small><b>${Number(w.priorPeriodClosed||0)}</b></span><span><small>เข้าและออกช่วงนี้</small><b>${Number(w.samePeriodClosed||0)}</b></span><span><small>ตรวจรับเสร็จ</small><b>${Number(w.receivingCompleted||0)}</b></span><span><small>ปฏิเสธรับ</small><b>${Number(w.receivingRejected||0)}</b></span></div>`}
function dashboardHandover(data){const w=data.workload||{},terms=dashboardHandoverTerms(data),count=Number(data.handoverItemCount||0);return`<section class="opsdash-grid r145-grid r145-handover r146-handover">${panel("รับ–ส่งต่องาน","เห็นงานที่รับต่อ รถเข้า รถออก และงานส่งต่อ",flowBalance(data),"r145-flow","handover")}${panel("งานที่ส่งต่อแยกตามขั้นตอน","รู้ว่ากะถัดไปต้องรับงานตรงไหน",stageQueueChart(w.handoverOutStages||data.activeStages||{}),"r145-stage","handover")}${panel("ผลงานของช่วง","งานที่ปิดได้ เทียบกับงานที่ยังเหลือ",handoverSummary(data),"r145-summary","handover")}${panel("รถที่ยังต้องทำต่อ",`${Math.min(count,5)} จาก ${count} รายการ`,actionTable(data.handoverItems||data.actionItems,5),"r145-list","handover")}</section>`}
function dashboardComparison(data){return`<section class="opsdash-grid r145-grid r145-comparison r146-comparison">${panel("แนวโน้มปริมาณงานและเวลา","รถเข้า · รถออก · เวลาเฉลี่ย",dailyComboChart(data.comparison?.daily||[]),"r145-trend","comparison")}${panel("ดีขึ้นหรือแย่ลง","เทียบช่วงก่อนหน้าที่มีความยาวเท่ากัน",comparisonSummary(data),"r145-compare-summary","comparison")}${panel("ผลแต่ละกะ","เทียบจำนวนงาน อัตราปิด และเวลาเฉลี่ย",shiftCompareChart(data.shiftPerformance||[]),"r145-shifts","comparison")}</section>`}
function comparisonSummary(data){const p=data.comparison?.previous||{},m=data.metrics||{},w=data.workload||{};return`<div class="comparison-summary r145-comparison-summary"><div><small>รถเข้า</small><b>${Number(w.gateIn??m.total??0)}</b><span>${comparisonNote(w.gateIn??m.total,p.total,"ช่วงก่อน")}</span></div><div><small>จบงาน</small><b>${Number(w.gateOut??m.closed??0)}</b><span>${comparisonNote(w.gateOut??m.closed,p.closed,"ช่วงก่อน")}</span></div><div><small>เวลาเฉลี่ย</small><b>${formatDuration(m.avgTotalSeconds)}</b><span>${comparisonNote(m.avgTotalSeconds,p.avgTotalSeconds,"ช่วงก่อน",true)}</span></div></div>`}
function dashboardCommand(data){return dashboardExceptions(data)}
function dashboardPerformance(data){const stages=[["รถเข้า → ยื่นเอกสาร",data.stageAverages?.gate_to_doc],["ยื่นเอกสาร → ตรวจเอกสารเสร็จ",data.stageAverages?.document_review],["ตรวจเอกสารเสร็จ → เริ่มตรวจรับ",data.stageAverages?.checked_to_start],["เริ่มตรวจรับ → รับสินค้าเสร็จ",data.stageAverages?.receiving],["รับสินค้าเสร็จ → คืนเอกสาร",data.stageAverages?.complete_to_return],["คืนเอกสาร → Gate Out",data.stageAverages?.return_to_out]];return`<section class="opsdash-grid r145-grid r145-performance r146-performance">${panel("เวลาเฉลี่ยแต่ละขั้นตอน","ชี้ว่ากระบวนการช้าตรงไหน",stageTimeChart(stages),"r145-stage-time","performance")}${panel("เวลารวมตามชั่วโมงรถเข้า","หาช่วงเวลาที่วงรอบยาวผิดปกติ",cycleTrendChart(data.hours||[],data.comparison?.targetTotalSeconds),"r145-cycle-trend","performance")}${panel("การกระจายเวลาปิดงาน","ดูจำนวนรถที่ใช้เวลาน้อย–มาก",cycleBandChart(data.cycleBands||[]),"r145-cycle-bands","performance")}${panel("ประสิทธิภาพแต่ละกะ","อัตราปิดงานและเวลาเฉลี่ย",performanceRows(data.shiftPerformance),"r145-shift-performance","performance")}</section>`}
function performanceSnapshot(data){const m=data.metrics||{},total=Number(m.total||0),closed=Number(m.closed||0),rate=total?closed*100/total:Number(m.completionRate||0);return`<div class="performance-snapshot"><div><small>ปิดงานแล้ว</small><b>${rate.toFixed(1)}%</b><span>${closed}/${total} คัน</span></div><div><small>ครึ่งหนึ่งจบภายใน</small><b>${durationValue(m.p50TotalSeconds)}</b><span>50% ของงานที่จบ</span></div><div><small>90% จบภายใน</small><b>${durationValue(m.p90TotalSeconds)}</b><span>ดูงานที่ใช้เวลานาน</span></div><div><small>เวลาเฉลี่ย</small><b>${durationValue(m.avgTotalSeconds)}</b><span>รถเข้า ถึง รถออก</span></div></div>`}

function flowBalance(data){const w=data.workload||{},metrics=data.metrics||{},terms=dashboardHandoverTerms(data),left=Number(w.carryIn||0)+Number(w.gateIn||0),right=Number(w.gateOut||0)+Number(w.carryOut||0),balanced=left===right,total=Number(metrics.total||0),closed=Number(metrics.closed||0),open=Math.max(0,total-closed),rate=total?Math.min(100,Math.max(0,closed*100/total)):0;return`<div class="flow-balance"><div><small>${terms.incomingShort}</small><b>${Number(w.carryIn||0)}</b></div><i>+</i><div><small>${terms.gateInShort}</small><b>${Number(w.gateIn||0)}</b></div><i>=</i><div><small>${terms.gateOutShort}</small><b>${Number(w.gateOut||0)}</b></div><i>+</i><div><small>${terms.outgoingShort}</small><b>${Number(w.carryOut||0)}</b></div></div><p class="balance-check ${balanced?"ok":"warn"}">${w.balanceApplicable?(balanced?`${terms.responsibilityLabel} ${left} คัน`:`ยอดรับ–ส่งต่าง ${Math.abs(left-right)} คัน · ตรวจเวลาต้นทาง`):"ช่วงหลายกะจะแสดงยอดรวมแต่ละกะ ไม่ใช้สมการยอดคงเหลือ"}</p><div class="flow-insight"><div class="completion-ring" style="--completion:${rate}%"><span><b>${rate.toFixed(0)}%</b><small>ปิดงาน</small></span></div><div class="flow-insight-stats"><div><small>${terms.metricGateInLabel}</small><b>${total}</b></div><div><small>ปิดแล้ว</small><b>${closed}</b></div><div><small>ยังไม่ปิด</small><b>${open}</b></div></div></div>`}
function handoverSummary(data){const w=data.workload||{},terms=dashboardHandoverTerms(data);return`<div class="handover-summary"><div><small>${terms.sameClosedLabel}</small><b>${Number(w.samePeriodClosed||0)}</b></div><div><small>${terms.inheritedClosedLabel}</small><b>${Number(w.priorPeriodClosed||0)}</b></div><div><small>${terms.receivingLabel}</small><b>${Number(w.receivingCompleted||0)}</b></div><div class="handover-rejected"><small>ปฏิเสธรับสินค้า</small><b>${Number(w.receivingRejected||0)}</b></div><div><small>${terms.outgoingSummaryLabel}</small><b>${Number(w.carryOut||0)}</b></div></div>`}
function stageTimeChart(stages){const values=stages.map(([,value])=>Math.max(0,Number(value)||0)),max=Math.max(1,...values);return`<div class="stage-time-chart">${stages.map(([label,value],index)=>`<div><span>${label}</span><i><em style="width:${values[index]/max*100}%"></em></i><b>${value==null?"–":formatDuration(value)}</b></div>`).join("")}</div>`}
function cycleBandChart(rows){const items=rows||[],max=Math.max(1,...items.map(row=>Number(row.total)||0));if(!items.length)return`<div class="empty-state">ยังไม่มีงานที่ปิดในช่วงนี้</div>`;return`<div class="cycle-band-chart">${items.map(row=>{const total=Number(row.total)||0;return`<div><b>${total}</b><i><em style="height:${Math.max(total?8:0,total/max*100)}%"></em></i><span>${escapeHtml(row.label)}</span></div>`}).join("")}</div>`}
function durationValue(value){return Number(value)>0?formatDuration(value):"–"}
function dashboardCapacity(data){const maxHour=Math.max(1,...(data.hours||[]).map(row=>Number(row.total)||0));return`<section class="opsdash-grid r145-grid r145-capacity r146-capacity">${panel("ภาระงานแต่ละประตู","จำนวนรถ ปิดงาน และเวลาเฉลี่ย",doorRows(data.doors),"r145-doors","capacity")}${panel("คุณภาพข้อมูลประตู","ข้อมูลขาดที่กระทบการจัดงาน",qualityRows(data.dataQuality),"r145-quality","capacity")}${panel("ช่วงรถเข้าหนาแน่น","ใช้เตรียมประตูและกำลังคน",hourChart(data.hours,maxHour),"r145-door-hours","capacity")}${panel("ความหนาแน่นประตู × เวลา","สีเข้มหมายถึงมีรถมาก",doorHeatmap(data.comparison?.doorHeatmap||[]),"r145-heatmap","capacity")}</section>`}
function dashboardExceptions(data){const b=data.bottleneck||dashboardClientBottleneck({},data.activeStages||{})||{};return`<section class="opsdash-grid r145-grid r145-exceptions r146-exceptions">${panel("ระดับความเสี่ยง","รถที่ยังอยู่ในพื้นที่",alertDonut(data.alertLevels),"r145-alerts","exceptions")}${panel("คอขวดที่ต้องแก้","ขั้นตอนที่มีรถค้างมากที่สุด",`<div class="command-callout r145-bottleneck"><small>จุดที่ต้องเข้าไปดู</small><b>${escapeHtml(b.label||"ไม่มีงานค้าง")}</b><span>${Number(b.queue||0)} คัน${Number(b.avg||0)>0?` · เวลาเฉลี่ย ${formatDuration(b.avg)}`:""}</span></div>`,"r145-bottleneck-panel","exceptions")}${panel("ข้อมูลผิดปกติ / ไม่ครบ","ตรวจแก้ก่อนใช้ตัดสินใจ",qualityRows(data.dataQuality),"r145-quality","exceptions")}${panel("รายการที่ต้องจัดการทันที",`เรียงจากระดับรุนแรงและเวลาค้าง`,actionTable(data.actionItems,5),"r145-list","exceptions")}</section>`}
function dailyComboChart(rows){if(!rows.length)return`<div class="empty-state">ยังไม่มีข้อมูลในช่วงที่เลือก</div>`;const items=rows.slice(-30),maxTotal=Math.max(1,...items.flatMap(row=>[Number(row.total)||0,Number(row.closed)||0])),maxAvg=Math.max(1,...items.map(row=>Number(row.avg_seconds)||0)),w=720,h=210,pad=28,step=(w-pad*2)/Math.max(1,items.length),points=items.map((row,index)=>`${pad+step*index+step/2},${h-pad-(Number(row.avg_seconds)||0)/maxAvg*(h-pad*2)}`).join(" ");return`<div class="opsdash-chart-scroll"><svg class="opsdash-combo round12-combo" viewBox="0 0 ${w} ${h}" role="img" aria-label="แนวโน้มรถเข้า รถปิดงาน และเวลาเฉลี่ยรายวัน">${items.map((row,index)=>{const total=Number(row.total)||0,closed=Number(row.closed)||0,center=pad+step*index+step/2,barWidth=Math.max(4,step*.28),totalHeight=total/maxTotal*(h-pad*2),closedHeight=closed/maxTotal*(h-pad*2);return`<rect class="gate-in-bar" x="${center-barWidth-1}" y="${h-pad-totalHeight}" width="${barWidth}" height="${totalHeight}" rx="3"/>${total?`<text class="bar-value" x="${center-barWidth/2-1}" y="${Math.max(12,h-pad-totalHeight-5)}" text-anchor="middle">${total}</text>`:""}<rect class="closed-bar" x="${center+1}" y="${h-pad-closedHeight}" width="${barWidth}" height="${closedHeight}" rx="3"/>${closed?`<text class="closed-value" x="${center+barWidth/2+1}" y="${Math.max(12,h-pad-closedHeight-5)}" text-anchor="middle">${closed}</text>`:""}<text x="${center}" y="${h-8}" text-anchor="middle">${escapeHtml(shortChartDate(row.day_key||row.label))}</text>`}).join("")}<polyline points="${points}"/>${items.map((row,index)=>`<circle cx="${pad+step*index+step/2}" cy="${h-pad-(Number(row.avg_seconds)||0)/maxAvg*(h-pad*2)}" r="3"><title>${escapeHtml(row.label)} · เข้า ${Number(row.total)||0} · ปิด ${Number(row.closed)||0} · เฉลี่ย ${formatDuration(row.avg_seconds)}</title></circle>`).join("")}</svg></div><div class="chart-legend"><span class="bar-key">รถเข้า</span><span class="closed-key">ปิดงาน</span><span class="line-key">เวลาเฉลี่ย</span></div>`}
function dailyLineChart(rows){if(!rows.length)return`<div class="empty-state">ยังไม่มีข้อมูลในช่วงที่เลือก</div>`;const items=rows.slice(-7),w=720,h=210,left=38,right=28,top=24,bottom=34,plotW=w-left-right,plotH=h-top-bottom,step=items.length>1?plotW/(items.length-1):0,maxTotal=Math.max(1,...items.map(row=>Number(row.total)||0)),validAvg=items.map(row=>Number(row.avg_seconds)||0).filter(value=>value>0),maxAvg=Math.max(1,...validAvg),x=index=>items.length===1?left+plotW/2:left+step*index,yTotal=value=>top+plotH-(Number(value)||0)/maxTotal*plotH,yAvg=value=>top+plotH-Number(value)/maxAvg*plotH,totalPoints=items.map((row,index)=>`${x(index)},${yTotal(row.total)}`),avgSegments=[];let current=[];items.forEach((row,index)=>{const value=Number(row.avg_seconds)||0;if(value>0)current.push(`${x(index)},${yAvg(value)}`);else if(current.length){avgSegments.push(current);current=[]}});if(current.length)avgSegments.push(current);const area=`${left},${top+plotH} ${totalPoints.join(" ")} ${x(items.length-1)},${top+plotH}`;return`<div class="opsdash-chart-scroll"><svg class="opsdash-daily-line" viewBox="0 0 ${w} ${h}" role="img" aria-label="แนวโน้มรถเข้าและเวลาเฉลี่ย 7 วัน"><defs><linearGradient id="dailyArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B82F6" stop-opacity=".28"/><stop offset="1" stop-color="#3B82F6" stop-opacity=".02"/></linearGradient></defs>${[0,.5,1].map(ratio=>`<line class="grid" x1="${left}" y1="${top+plotH*ratio}" x2="${w-right}" y2="${top+plotH*ratio}"/>`).join("")}<polygon class="total-area" points="${area}"/><polyline class="total-line" points="${totalPoints.join(" ")}"/>${avgSegments.map(points=>`<polyline class="average-line" points="${points.join(" ")}"/>`).join("")}${items.map((row,index)=>{const total=Number(row.total)||0,avg=Number(row.avg_seconds)||0;return`<circle class="total-dot" cx="${x(index)}" cy="${yTotal(total)}" r="4"><title>${escapeHtml(shortChartDate(row.label))} · รถเข้า ${total} คัน</title></circle><text class="total-value" x="${x(index)}" y="${Math.max(12,yTotal(total)-8)}" text-anchor="middle">${total}</text>${avg>0?`<circle class="average-dot" cx="${x(index)}" cy="${yAvg(avg)}" r="3.5"><title>${escapeHtml(shortChartDate(row.label))} · เวลาเฉลี่ย ${formatDuration(avg)}</title></circle>`:""}<text class="date-label" x="${x(index)}" y="${h-9}" text-anchor="middle">${escapeHtml(shortChartDate(row.label))}</text>`}).join("")}</svg></div><div class="chart-legend line-chart-legend"><span class="total-line-key">รถเข้า</span><span class="average-line-key">เวลาเฉลี่ย</span></div>`}
function shortChartDate(label){const text=String(label||"");const match=text.match(/^(\d{4})-(\d{2})-(\d{2})/);return match?`${match[3]}/${match[2]}`:text.slice(0,5)}
function shiftCompareChart(rows){if(!rows.length)return`<div class="empty-state">ยังไม่มีข้อมูลกะ</div>`;const max=Math.max(1,...rows.map(row=>Number(row.total)||0));return`<div class="shift-compare">${rows.map(row=>{const total=Number(row.total||0),closed=Number(row.closed||0),rate=total?Math.round(closed*1000/total)/10:0;return`<div style="--shift:${safeColor(row.color||"#416FC3")}"><header><b>${escapeHtml(row.label)}</b><small>${row.start_minute==null?"ไม่ระบุเวลา":`${minuteToTime(row.start_minute)}–${minuteToTime(row.end_minute)}`}</small></header><i><em style="width:${total/max*100}%"></em></i><span><b>${total}</b> คัน · ปิด ${rate.toFixed(1)}% · เฉลี่ย ${formatDuration(row.avg_seconds)}</span></div>`}).join("")}</div>`}
function cycleTrendChart(rows,target){const source=rows||[],items=Array.from({length:24},(_,hour)=>source.find(row=>Number(row.hour)===hour)||null),valid=items.filter(row=>row&&Number(row.avg_seconds)>0);if(!valid.length)return`<div class="empty-state">ยังไม่มีเวลาปิดงานสำหรับชั่วโมงที่เลือก</div>`;const max=Math.max(1,Number(target||0),...valid.map(row=>Number(row.avg_seconds)||0)),targetY=target?164-Number(target)/max*126:null,segments=[];let current=[];items.forEach((row,index)=>{if(row&&Number(row.avg_seconds)>0)current.push(`${24+index*28},${164-Number(row.avg_seconds)/max*126}`);else if(current.length){segments.push(current);current=[]}});if(current.length)segments.push(current);return`<div class="opsdash-chart-scroll"><svg class="opsdash-line" viewBox="0 0 700 185" role="img" aria-label="แนวโน้มเวลารวมแต่ละชั่วโมง">${targetY==null?"":`<line class="target" x1="24" y1="${targetY}" x2="668" y2="${targetY}"/><text x="26" y="${targetY-5}">เกณฑ์ ${formatDuration(target)}</text>`}${segments.map(points=>`<polyline points="${points.join(" ")}"/>`).join("")}${items.map((row,index)=>`${row&&Number(row.avg_seconds)>0?`<circle cx="${24+index*28}" cy="${164-Number(row.avg_seconds)/max*126}" r="3"><title>${String(index).padStart(2,"0")}:00 · ${formatDuration(row.avg_seconds)}</title></circle>`:""}<text x="${24+index*28}" y="180" text-anchor="middle">${index%3===0?String(index).padStart(2,"0"):""}</text>`).join("")}</svg></div>`}
function doorHeatmap(rows){if(!rows.length)return`<div class="empty-state">ยังไม่มีข้อมูลประตูในช่วงที่เลือก</div>`;const totals=new Map();for(const row of rows)totals.set(row.door_code,(totals.get(row.door_code)||0)+Number(row.total||0));const doors=[...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([door])=>door),max=Math.max(1,...rows.filter(row=>doors.includes(row.door_code)).map(row=>Number(row.total)||0));return`<div class="door-heat-wrap"><div class="door-heat" style="--hours:24"><span></span>${Array.from({length:24},(_,h)=>`<small>${h%3===0?String(h).padStart(2,"0"):""}</small>`).join("")}${doors.map(door=>`<b>${escapeHtml(door)}</b>${Array.from({length:24},(_,hour)=>{const row=rows.find(item=>item.door_code===door&&Number(item.hour)===hour),value=Number(row?.total||0);return`<i style="--heat:${value/max}" title="${escapeHtml(door)} · ${String(hour).padStart(2,"0")}:00 · ${value} คัน"></i>`}).join("")}`).join("")}</div></div>`}
function hourChart(rows,max){const maximum=Math.max(1,Number(max)||0),items=Array.from({length:24},(_,hour)=>{const row=(rows||[]).find(item=>Number(item.hour)===hour),value=Math.max(0,Number(row?.total||0)),height=value?Math.max(6,value/maximum*100):0,label=`${String(hour).padStart(2,"0")}:00 · ${value} คัน`;return`<div class="${value?"has-value":""}" title="${label}" aria-label="${label}"><b aria-hidden="true">${value||""}</b><i style="height:${height}%" aria-hidden="true"></i><small aria-hidden="true">${hour%3===0?String(hour).padStart(2,"0"):""}</small></div>`}).join("");return`<div class="hour-chart-scroll" role="img" aria-label="จำนวนรถเข้าจำแนกตามชั่วโมง"><div class="hour-chart">${items}</div></div>`}
function alertRows(levels){return[["วิกฤต","CRITICAL"],["ล่าช้า","URGENT"],["เตือน","WARNING"],["เฝ้าระวัง","WATCH"],["ปกติ","NORMAL"]].map(([label,key])=>({label,total:Number(levels?.[key]||0)}))}
function stageQueueChart(stages){const rows=[["รอยื่นเอกสาร","WAITING_DOCUMENT_SUBMISSION","#2563EB"],["รอตรวจเอกสาร","WAITING_DOCUMENT_CHECK","#F59E0B"],["พร้อมตรวจรับ","READY_FOR_RECEIVING","#059669"],["กำลังตรวจรับ","RECEIVING_IN_PROGRESS","#0D9488"],["รอรับเอกสารคืน","WAITING_DOCUMENT_RETURN","#D97706"],["รอออกจากพื้นที่","WAITING_GATE_OUT","#EA580C"]].map(([label,key,color])=>({label,total:Number(stages?.[key]||0),color})),max=Math.max(1,...rows.map(row=>row.total)),top=Math.max(...rows.map(row=>row.total));return`<div class="stage-queue-chart r146-stage-queue">${rows.map(row=>`<div class="${top>0&&row.total===top?"is-bottleneck":""}" style="--stage-color:${row.color}"><span>${row.label}${top>0&&row.total===top?`<em>คอขวด</em>`:""}</span><i><em style="width:${row.total/max*100}%"></em></i><b>${row.total}</b></div>`).join("")}</div>`}
function backlogAgingChart(rows){const stages=[["WAITING_DOCUMENT_SUBMISSION","รอยื่นเอกสาร","#2563EB"],["WAITING_DOCUMENT_CHECK","รอตรวจเอกสาร","#F59E0B"],["READY_FOR_RECEIVING","พร้อมตรวจรับ","#059669"],["RECEIVING_IN_PROGRESS","กำลังตรวจรับ","#0D9488"],["WAITING_DOCUMENT_RETURN","รอรับเอกสารคืน","#D97706"],["WAITING_GATE_OUT","รอออกจากพื้นที่","#EA580C"]],items=rows||[],max=Math.max(1,...items.map(row=>Number(row.total)||0));return`<div class="backlog-aging-legend">${stages.map(([,label,color])=>`<span><i style="background:${color}"></i>${label}</span>`).join("")}</div><div class="backlog-aging-chart">${items.map(row=>{const total=Number(row.total)||0;return`<div><span>${escapeHtml(row.label)}</span><i class="aging-track" style="width:${Math.max(total?8:0,total/max*100)}%">${stages.map(([key,,color])=>{const value=Number(row.stages?.[key]||0);return value?`<em style="flex:${value};background:${color}" title="${statusLabel(key)} ${value} คัน"></em>`:""}).join("")}</i><b>${total}</b></div>`}).join("")||`<div class="empty-state">ไม่มีรถค้าง ณ ปลายช่วง</div>`}</div>`}
function alertDonut(levels){const rows=alertRows(levels),total=rows.reduce((sum,row)=>sum+row.total,0),critical=Number(levels?.CRITICAL||0),urgent=Number(levels?.URGENT||0),warning=Number(levels?.WARNING||0),watch=Number(levels?.WATCH||0),normal=Number(levels?.NORMAL||0),percent=value=>total?value*100/total:0,a=percent(critical),b=a+percent(urgent),c=b+percent(warning),d=c+percent(watch);return`<div class="alert-donut-wrap"><div class="alert-donut" style="--a:${a}%;--b:${b}%;--c:${c}%;--d:${d}%"><span><b>${total}</b><small>รวม</small></span></div><div class="alert-donut-legend">${[["วิกฤต",critical,"#DC2626"],["ล่าช้า",urgent,"#F97316"],["เตือน",warning,"#F59E0B"],["เฝ้าระวัง",watch,"#06B6D4"],["ปกติ",normal,"#2563EB"]].map(([label,value,color])=>`<span><i style="background:${color}"></i>${label}<b>${value}</b></span>`).join("")}</div></div>`}
function dashboardPriorityList(rows,limit=5){const shown=(rows||[]).slice(0,Math.max(1,Number(limit)||5));return`<div class="r145-priority-list r146-priority-list">${shown.map(row=>`<div style="--alert-color:${safeColor(row.alert_color)}"><i></i><strong><b>${escapeHtml(row.appointment_no||row.auto_id)}</b><small>${escapeHtml(row.company_name||"ไม่ระบุบริษัท")} · ${escapeHtml(joinText(row.vehicle_plate,row.province)||"ไม่ระบุทะเบียน")}</small></strong><span><b>${statusLabel(row.current_status)}</b><small>${row.door_code?`ประตู ${escapeHtml(row.door_code)}`:"ยังไม่ระบุประตู"}</small></span><em><small>ค้าง</small><b>${formatDuration(row.stage_elapsed_seconds)}</b></em><mark>${alertLevelLabel(row.alert_level)}</mark></div>`).join("")||`<div class="empty-state r146-all-clear"><b>ไม่มีงานเร่งด่วน</b><span>รายการปัจจุบันยังไม่เกินระดับเตือน</span></div>`}</div>`}
function actionTable(rows,limit=5){const shown=(rows||[]).slice(0,Math.max(1,Number(limit)||5));return`<div class="action-table-head"><span>ระดับ</span><span>เลขนัดหมาย / บริษัท</span><span>ทะเบียนรถ</span><span>ขั้นตอน</span><span>ประตู</span><span>เวลาขั้นตอน</span><span>เวลารวม</span></div>${shown.map(row=>`<div class="action-table-row" style="--alert-color:${safeColor(row.alert_color)}"><b data-label="ระดับ">${alertLevelLabel(row.alert_level)}</b><strong class="dashboard-company-cell" data-label="เลขนัดหมาย / บริษัท"><span>${escapeHtml(row.appointment_no||row.auto_id)}</span><small>${escapeHtml(row.company_name||"ไม่ระบุบริษัท")}</small></strong><span data-label="ทะเบียนรถ">${escapeHtml(joinText(row.vehicle_plate,row.province))}</span><span data-label="ขั้นตอน">${statusLabel(row.current_status)}</span><span data-label="ประตู">${escapeHtml(row.door_code||"–")}</span><b data-label="เวลาขั้นตอน">${formatDuration(row.stage_elapsed_seconds)}</b><b data-label="เวลารวม">${formatDuration(row.total_elapsed_seconds)}</b></div>`).join("")||`<div class="empty-state">ไม่มีรายการที่ต้องติดตาม</div>`}`}
function performanceRows(rows){return`<div class="performance-rows">${(rows||[]).map(row=>`<div><span>${escapeHtml(row.label)}</span><b>${Number(row.closed||0)}/${Number(row.total||0)}</b><small>เฉลี่ย ${formatDuration(row.avg_seconds)}</small></div>`).join("")||`<div class="empty-state">ไม่มีข้อมูล</div>`}</div>`}
function doorRows(rows,limit=8){const shown=[...(rows||[])].sort((a,b)=>Number(b.total||0)-Number(a.total||0)).slice(0,Math.max(1,Number(limit)||8)),max=Math.max(1,...shown.map(row=>Number(row.total)||0));return`<div class="door-capacity-rows">${shown.map(row=>`<div><b>${escapeHtml(row.label)}</b><i><em style="width:${Number(row.total)/max*100}%"></em></i><span>${Number(row.total)} คัน</span><small>ปิด ${Number(row.closed||0)} · เฉลี่ย ${formatDuration(row.avg_seconds)}</small></div>`).join("")||`<div class="empty-state">ไม่มีข้อมูลประตู</div>`}</div>`}
function qualityRows(q){return dashboardBars([{label:"นัดหมายว่าง/0",total:q?.missing_appointment},{label:"ไม่มีทะเบียนรถ",total:q?.missing_plate},{label:"ไม่ระบุกะ",total:q?.missing_shift},{label:"ขาดประตูที่บังคับ",total:q?.missing_required_door}])}
function recentTable(rows){return`<div class="dashboard-table-head"><span>เลขนัดหมาย / บริษัท</span><span>ทะเบียนรถ</span><span>ประตู</span><span>Gate Out</span><span>เวลารวม</span></div>${(rows||[]).map(row=>`<div class="dashboard-table-row"><b class="dashboard-company-cell" data-label="เลขนัดหมาย / บริษัท"><span>${escapeHtml(row.appointment_no||row.auto_id)}</span><small>${escapeHtml(row.company_name||"ไม่ระบุบริษัท")}</small></b><span data-label="ทะเบียนรถ">${escapeHtml(joinText(row.vehicle_plate,row.province))}</span><span data-label="ประตู">${escapeHtml(row.door_code||"–")}</span><span data-label="Gate Out">${formatDate(row.gate_out_at)}</span><b data-label="เวลารวม">${formatDuration(row.total_seconds)}</b></div>`).join("")||`<div class="empty-state">ยังไม่มีงานที่ปิด</div>`}`}
function dashboardInfoForKey(key,data){const base=DASHBOARD_INFO[key]||DASHBOARD_INFO.dashboard,terms=dashboardHandoverTerms(data);if(key==="gateOut")return{...base,meaning:terms.selected?`จำนวนรถที่ Gate Out ภายใน ${terms.shiftName} รวมทั้งงานที่รับต่อมาและปิดได้ในกะนี้`:"จำนวนรถที่ Gate Out ภายในช่วงที่เลือก รวมทั้งงานค้างก่อนช่วงที่ปิดได้"};if(key==="carryOut")return{...base,title:terms.outgoingKpiLabel,meaning:terms.selected?`รถที่ยังไม่มี Gate Out เมื่อสิ้นสุด ${terms.shiftName} และต้องส่งต่อให้กะถัดไป`:"รถที่ยังไม่มี Gate Out เมื่อสิ้นสุดช่วงข้อมูล",calculation:terms.selected?`นับรถที่อยู่ในพื้นที่เมื่อสิ้นสุด ${terms.shiftName}`:"นับรถที่อยู่ในพื้นที่เมื่อสิ้นสุดช่วงที่เลือก"};if(key==="flow")return{...base,title:terms.flowTitle,meaning:terms.flowNote,calculation:`${terms.incomingShort} + ${terms.gateInShort} ควรเท่ากับ ${terms.gateOutShort} + ${terms.outgoingShort} เมื่อเป็นช่วงเดียว`};if(key==="stageQueue")return{...base,title:terms.queueTitle,meaning:terms.selected?`จำนวนรถที่ต้องส่งต่อหลังสิ้นสุด${terms.shiftName} แยกตามขั้นตอนล่าสุด`:"จำนวนรถที่ยังคงค้างเมื่อสิ้นสุดช่วง แยกตามขั้นตอนล่าสุด"};if(key==="handover")return{...base,title:terms.flowTitle,meaning:terms.selected?`แยกงานที่ ${terms.shiftName} รับต่อมา รถเข้าใหม่ งานที่ปิดได้ และรถที่ต้องส่งต่อไปกะถัดไป`:"แยกงานค้างก่อนช่วง รถเข้าใหม่ งานที่ปิดได้ และงานค้างปลายช่วง",calculation:terms.selected?`งานส่งต่อคือรถที่ยังไม่ Gate Out เมื่อสิ้นสุด ${terms.shiftName}`:"งานค้างปลายช่วงคือรถที่ยังไม่ Gate Out เมื่อสิ้นสุดช่วงข้อมูล"};return base}
function showDashboardInfo(key){const data=dashboardState.data||{},ctx=data.shiftContext||{},shift=ctx.startMinute==null?"ทุกกะ":`${escapeHtml(ctx.shiftName||"กะที่เลือก")} ${minuteToTime(ctx.startMinute)}–${minuteToTime(ctx.endMinute)}${ctx.crossesMidnight?" ข้ามวัน":""}`,period=data.from?`${formatDate(data.from)} – ${formatDate(Number(data.to)-1)}`:"ตามตัวกรองปัจจุบัน";
  const groups=[["ตัวชี้วัดหลัก",["gateIn","gateOut","carryOut","receivingCompleted","average","p90"]],["แผงข้อมูลหลัก",["flow","hourly","stageQueue","aging","urgent"]],["แท็บวิเคราะห์",["comparison","handover","performance","capacity","exceptions"]]];
  const sections=groups.map(([label,keys])=>`<section class="dashboard-info-group"><h4>${label}</h4><div class="dashboard-info-list">${keys.map(itemKey=>{const info=dashboardInfoForKey(itemKey,data);return`<article><b>${info.title}</b><p><strong>หมายถึง:</strong> ${info.meaning}</p><p><strong>แหล่งข้อมูล:</strong> ${info.source}</p><p><strong>วิธีคำนวณ:</strong> ${info.calculation}</p></article>`}).join("")}</div></section>`).join("");
  Swal.fire({title:"คำอธิบายข้อมูล Dashboard",html:`<div class="dashboard-info-sheet dashboard-info-sheet-center"><div class="info-period"><b>ขอบเขตที่กำลังดู</b><p>${period}<br>${shift}</p></div><div class="dashboard-info-intro"><b>คำเรียกในหน้ารับ–ส่งต่องาน</b><p>เมื่อเลือกกะเดียว ระบบใช้คำว่า “รับต่องานมา” และ “ส่งต่อไปกะถัดไป” โดยไม่ระบุว่ามาจากกะใด หากข้อมูลไม่ได้ยืนยันกะต้นทาง ส่วนช่วงหลายกะจะใช้คำว่า “ค้างก่อนช่วง” และ “ค้างปลายช่วง”</p></div>${sections}</div>`,confirmButtonText:"เข้าใจแล้ว",customClass:swalClasses(),buttonsStyling:false,width:760})}
function formatDashboardDateKey(key){if(!key)return"เลือกวันที่";const parts=String(key).split("-");return parts.length===3?`${parts[2]}/${parts[1]}/${parts[0]}`:"เลือกวันที่"}
function formatDashboardCompactDateKey(key){if(!key)return"วันที่";const parts=String(key).split("-");return parts.length===3?`${parts[2]}/${parts[1]}`:"วันที่"}
function toggleDashboardMobileMenu(){const menu=$("dashboardMobileMenu"),button=$("dashboardMoreButton");if(!menu||!button)return;menu.hidden=!menu.hidden;button.setAttribute("aria-expanded",menu.hidden?"false":"true")}
function closeDashboardMobileMenu(){const menu=$("dashboardMobileMenu"),button=$("dashboardMoreButton");if(menu)menu.hidden=true;if(button)button.setAttribute("aria-expanded","false")}
function toggleDashboardCalendar(){const popover=$("dashboardCalendarPopover");if(!popover)return;popover.hidden=!popover.hidden;if(!popover.hidden)loadDashboardCalendar()}
async function loadDashboardCalendar(){const popover=$("dashboardCalendarPopover");if(!popover)return;const base=dashboardState.date||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());dashboardState.calendarMonth=dashboardState.calendarMonth||base.slice(0,7);popover.innerHTML=`<div class="loading">กำลังโหลดปฏิทิน</div>`;try{dashboardState.calendarData=await api(`/api/dashboard/calendar?month=${encodeURIComponent(dashboardState.calendarMonth)}`);renderDashboardCalendar()}catch(error){popover.innerHTML=`<div class="calendar-error">โหลดปฏิทินไม่สำเร็จ<br><button id="retryCalendar" class="outline-button">ลองใหม่</button></div>`;$("retryCalendar")?.addEventListener("click",loadDashboardCalendar)}}
function dashboardTodayKey(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function renderDashboardCalendar(){const popover=$("dashboardCalendarPopover"),data=dashboardState.calendarData;if(!popover||!data)return;const [year,month]=data.month.split("-").map(Number),firstDay=new Date(Date.UTC(year,month-1,1)).getUTCDay(),metric=dashboardState.calendarMetric,labels={gateIn:"รถเข้า",carryOut:"คงค้าง",overdue:"เร่งด่วน"},days=Array(firstDay).fill(null).concat(data.days||[]),today=dashboardTodayKey();popover.innerHTML=`<header><button type="button" data-calendar-move="-1" aria-label="เดือนก่อน">‹</button><b>${new Intl.DateTimeFormat("th-TH",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(Date.UTC(year,month-1,1)))}</b><button type="button" data-calendar-move="1" aria-label="เดือนถัดไป">›</button></header><div class="calendar-metrics">${Object.entries(labels).map(([id,label])=>`<button type="button" data-calendar-metric="${id}" class="${metric===id?"active":""}">${label}</button>`).join("")}</div><div class="calendar-week"><span>อา</span><span>จ</span><span>อ</span><span>พ</span><span>พฤ</span><span>ศ</span><span>ส</span></div><div class="calendar-grid">${days.map(day=>{if(!day)return`<i></i>`;const value=Number(day[metric]||0),future=day.date>today,tone=future?"future":Number(day.overdue)>0?"overdue":Number(day.carryOut)>0?"carry":value>0?"active":"empty",selected=day.date===dashboardState.date?"selected":"";return`<button type="button" ${future?"disabled":""} data-calendar-date="${day.date}" class="${tone} ${selected}" aria-label="${future?"วันที่ในอนาคต":`${day.date} ${labels[metric]} ${value} คัน`}"><span>${Number(day.date.slice(-2))}</span><b>${future?"":value||"–"}</b></button>`}).join("")}</div><footer><span><i class="clear"></i>มีงาน</span><span><i class="carry"></i>คงค้าง</span><span><i class="overdue"></i>เร่งด่วน</span><button type="button" id="calendarToday">วันนี้</button></footer>`;popover.querySelectorAll("[data-calendar-move]").forEach(button=>button.addEventListener("click",()=>moveDashboardMonth(Number(button.dataset.calendarMove))));popover.querySelectorAll("[data-calendar-metric]").forEach(button=>button.addEventListener("click",()=>{dashboardState.calendarMetric=button.dataset.calendarMetric;renderDashboardCalendar()}));popover.querySelectorAll("[data-calendar-date]:not(:disabled)").forEach(button=>button.addEventListener("click",()=>selectDashboardDate(button.dataset.calendarDate)));$("calendarToday")?.addEventListener("click",()=>selectDashboardDate(today))}
function moveDashboardMonth(offset){const [year,month]=dashboardState.calendarMonth.split("-").map(Number),next=new Date(Date.UTC(year,month-1+offset,1));dashboardState.calendarMonth=`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,"0")}`;loadDashboardCalendar()}
function selectDashboardDate(date){dashboardState.shiftAutoDate=false;dashboardState.date=date;dashboardState.calendarMonth=date.slice(0,7);dashboardState.lastLoadedAt=0;const popover=$("dashboardCalendarPopover");if(popover)popover.hidden=true;loadDashboard(true,true)}
function setDashboardShell(view){const shell=$("appView");if(!shell)return;shell.classList.toggle("dashboard-view-shell",view==="dashboard");shell.classList.toggle("datatable-view-shell",view==="datatable");shell.classList.remove("dashboard-menu-open");if(view!=="dashboard")shell.classList.remove("dashboard-fullscreen-shell");if(view!=="datatable"){datatableState.immersive=false;datatableState.nativeFullscreen=false;shell.classList.remove("datatable-fullscreen-shell")}syncDashboardFullscreenShell();syncDatatableFullscreenShell()}
function syncDatatableFullscreenShell(){const shell=$("appView");if(!shell)return;const active=state.view==="datatable"&&Boolean(datatableState.immersive||document.fullscreenElement);shell.classList.toggle("datatable-fullscreen-shell",active);document.body.classList.toggle("datatable-fullscreen-active",active);} 
function syncDashboardFullscreenShell(){const shell=$("appView");if(!shell)return;const active=state.view==="dashboard"&&Boolean(document.fullscreenElement);shell.classList.toggle("dashboard-fullscreen-shell",active);if(!active)shell.classList.remove("dashboard-menu-open");syncDashboardMenuButton()}
function toggleDashboardMenu(){const shell=$("appView");if(!shell?.classList.contains("dashboard-fullscreen-shell"))return;shell.classList.toggle("dashboard-menu-open");syncDashboardMenuButton()}
function syncDashboardMenuButton(){const button=$("dashboardMenuButton"),open=$("appView")?.classList.contains("dashboard-menu-open");if(!button)return;button.setAttribute("aria-expanded",open?"true":"false");button.setAttribute("aria-label",open?"ปิดเมนู":"เปิดเมนู")}


function appointmentStopWorker(){try{appointmentUploadState.worker?.terminate()}catch{}appointmentUploadState.worker=null;appointmentUploadState.busy=false}
function appointmentDisplayDate(iso){const m=String(iso||"").match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?`${m[3]}/${m[2]}/${m[1]}`:"-"}
function appointmentDisplayMinute(value){const n=Number(value);if(!Number.isInteger(n)||n<0||n>1439)return"-";return`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`}
function appointmentDisplaySnapshot(date,time){const d=String(date||"").match(/^(\d{4})-(\d{2})-(\d{2})$/),t=String(time||"").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);return d&&t?`${d[3]}/${d[2]}/${d[1]} ${t[1]}:${t[2]}:${t[3]||"00"}`:"-"}
function appointmentParseSnapshot(value){const m=String(value||"").trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);if(!m)return null;const d=Number(m[1]),mo=Number(m[2]),y=Number(m[3]),h=Number(m[4]),mi=Number(m[5]),sec=Number(m[6]),dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d||h>23||mi>59||sec>59)return null;return{snapshotDate:`${y}-${String(mo).padStart(2,"0")}-${String(d).padStart(2,"0")}`,snapshotTime:`${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}:${String(sec).padStart(2,"0")}`}}
function appointmentSnapshotNumericKey(snapshot){if(!snapshot?.snapshotDate||!snapshot?.snapshotTime)return 0;return Number(String(snapshot.snapshotDate).replace(/-/g,"")+String(snapshot.snapshotTime).replace(/:/g,""))||0}
function appointmentInferSnapshot(fileName){const m=String(fileName||"").match(/(?:^|\D)(\d{2})(\d{2})(\d{4}|\d{2})[_\-\s]+(\d{1,2})[.:](\d{2})(?:\D|$)/);if(!m)return"";const d=Number(m[1]),mo=Number(m[2]),y=m[3].length===4?Number(m[3]):2000+Number(m[3]),h=Number(m[4]),mi=Number(m[5]),dt=new Date(Date.UTC(y,mo-1,d));if(dt.getUTCFullYear()!==y||dt.getUTCMonth()+1!==mo||dt.getUTCDate()!==d||h>23||mi>59)return"";return`${String(d).padStart(2,"0")}/${String(mo).padStart(2,"0")}/${y} ${String(h).padStart(2,"0")}:${String(mi).padStart(2,"0")}:00`}
function appointmentWarningCount(){return(appointmentUploadState.result?.appointments||[]).reduce((n,a)=>n+(a.warnings?.length?1:0),0)}
function appointmentIssueCount(){return Number(appointmentUploadState.result?.stats?.invalidRows||0)+appointmentWarningCount()}
function appointmentImportItem(a){return{dc:a.dc,appointment:a.appointment,date:a.date,period:a.period,from:a.from,to:a.to,referenceType:a.referenceType,referenceMinute:a.referenceMinute,vendors:a.vendors,carriers:a.carriers,lines:a.lines||[],raw:a.raw||{}}}
function appointmentCountsHtml(counts={}){const rows=[["เพิ่มใหม่",Number(counts.inserted||0)],["ปรับข้อมูล",Number(counts.updated||0)],["เดิม",Number(counts.unchanged||0)]];if(Number(counts.olderSkipped||0)>0)rows.push(["ข้อมูลเก่ากว่า",Number(counts.olderSkipped||0)]);if(Number(counts.conflicts||0)>0)rows.push(["ต้องตรวจ",Number(counts.conflicts||0)]);return`<div class="appointment-swal-counts">${rows.map(([l,v])=>`<span><small>${l}</small><b>${v.toLocaleString()}</b></span>`).join("")}</div>`}
function appointmentSetBusy(on,message=""){
  appointmentUploadState.busy=Boolean(on);
  const el=$("appointmentUploadProgress");if(el){el.hidden=!on;el.textContent=on?message:""}
  const choose=$("appointmentFileInput");if(choose)choose.disabled=Boolean(on);
  const previewButton=$("appointmentPreviewChanges");if(previewButton){previewButton.disabled=Boolean(on);previewButton.classList.toggle("is-busy",Boolean(on));previewButton.textContent=on?"กำลังตรวจข้อมูล":"ตรวจการเปลี่ยนแปลง"}
  const confirmButton=$("appointmentConfirmImport");if(confirmButton){const ready=Boolean(appointmentUploadState.preview?.acknowledged&&appointmentUploadState.preview?.canImport);confirmButton.disabled=Boolean(on)||!ready;confirmButton.classList.toggle("is-busy",Boolean(on))}
}
function appointmentClearResult(){appointmentUploadState.result=null;appointmentUploadState.preview=null;const result=$("appointmentUploadResult");if(result)result.hidden=true}

async function renderAppointmentUpload(){
  if(!["ADMIN","USER"].includes(state.user?.accessRights))return navigate(state.user?.accessRights==="INBOUND"?"inbound":"operations");
  appointmentStopWorker();appointmentUploadState.result=null;appointmentUploadState.preview=null;
  $("pageContent").innerHTML=`<div class="loading">กำลังเตรียมหน้าข้อมูลนัดหมาย</div>`;
  try{const data=await api("/api/appointment/upload-config");appointmentUploadState.config=data;state.appointment=normalizeAppointmentAccess(data.appointmentModule);renderNavigation();if(!viewEnabled("appointmentUpload"))return navigate("operations");renderAppointmentUploadShell()}catch(error){$("pageContent").innerHTML=`<div class="empty-state"><b>เปิดหน้าข้อมูลนัดหมายไม่ได้</b><span>${escapeHtml(error.message)}</span><button id="retryAppointmentUpload" class="primary">ลองใหม่</button></div>`;$("retryAppointmentUpload")?.addEventListener("click",renderAppointmentUpload)}
}
function renderAppointmentUploadShell(){
  const data=appointmentUploadState.config||{},latest=data.schema?.latest;
  $("pageContent").innerHTML=`<section class="appointment-upload-head"><div><h2>ข้อมูลนัดหมาย</h2><p>เลือกไฟล์จากส่วนกลาง ตรวจข้อมูลก่อนบันทึก และใช้สิทธิ์ผู้ใช้งานของระบบนี้</p></div><label class="appointment-file-button">เลือกไฟล์<input id="appointmentFileInput" type="file" accept=".xlsb,.xlsx,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label></section><section class="appointment-latest-card"><div><small>ชุดข้อมูลล่าสุด</small><b id="appointmentLatestSnapshot">${latest?escapeHtml(appointmentDisplaySnapshot(latest.snapshotDate,latest.snapshotTime)):"ยังไม่มีข้อมูล"}</b><span id="appointmentLatestFile">${latest?.fileName?escapeHtml(latest.fileName):"รอนำเข้าไฟล์นัดหมาย"}</span></div><div><small>สถานะการใช้งานกับงานจริง</small><b>${data.appointmentModule?.useImportedData?"เปิด":"ยังปิด"}</b><span>${data.appointmentModule?.useImportedData?"ระบบงานสามารถเรียกข้อมูลนัดหมายได้":"การนำเข้าไม่กระทบ Gate In จนกว่าจะเปิดใช้งาน"}</span></div></section><div id="appointmentUploadProgress" class="appointment-upload-progress" hidden></div><section id="appointmentUploadResult" hidden><div class="appointment-upload-summary"><article><small>ข้อมูลทั้งหมด</small><b id="appointmentSourceRows">0</b></article><article><small>ของคลังนี้</small><b id="appointmentWarehouseRows">0</b></article><article><small>นัดหมาย</small><b id="appointmentTotalCount">0</b></article><article><small>ต้องตรวจ</small><b id="appointmentIssueTotal">0</b></article></div><section class="appointment-file-summary"><div><b id="appointmentSelectedFile">-</b><span id="appointmentFileRange">-</span></div><span id="appointmentFileStatus">พร้อมตรวจสอบ</span></section><section class="appointment-preview-card"><header><div><h3>รายการนัดหมาย</h3><small id="appointmentShownCount"></small></div><input id="appointmentSearchInput" placeholder="ค้นหา Appointment / บริษัท / Carrier / PO"></header><div class="appointment-table-wrap"><table><thead><tr><th>Appointment</th><th>วันที่</th><th>PERIOD</th><th>FROM</th><th>TO</th><th>บริษัท</th><th>Carrier</th><th>PO</th></tr></thead><tbody id="appointmentPreviewBody"></tbody></table></div></section><section id="appointmentIssuePanel" class="appointment-issue-card" hidden><header><b>รายการที่ต้องตรวจ</b><span id="appointmentIssueSummary"></span></header><div id="appointmentIssueRows"></div></section><section id="appointmentImportPanel" class="appointment-import-card"><div><h3>นำเข้าข้อมูล</h3><p>วันที่และเวลาของชุดข้อมูลต้องเป็นรูปแบบ dd/MM/yyyy HH:mm:ss</p></div><label>วันที่เวลาชุดข้อมูล<input id="appointmentSnapshotInput" inputmode="numeric" maxlength="19" placeholder="18/08/2026 18:00:00"></label><div class="appointment-import-actions"><button id="appointmentPreviewChanges" class="outline-button">ตรวจการเปลี่ยนแปลง</button><button id="appointmentConfirmImport" class="primary" disabled>ยืนยันนำเข้า</button></div></section></section>`;
  $("appointmentFileInput")?.addEventListener("change",()=>appointmentParseFile($("appointmentFileInput").files?.[0]));
  $("appointmentSearchInput")?.addEventListener("input",appointmentRenderPreview);
  $("appointmentSnapshotInput")?.addEventListener("input",()=>{appointmentUploadState.preview=null;const b=$("appointmentConfirmImport");if(b)b.disabled=true});
  $("appointmentPreviewChanges")?.addEventListener("click",appointmentPreviewChanges);
  $("appointmentConfirmImport")?.addEventListener("click",appointmentImportData);
}
async function appointmentParseFile(file){
  if(!file)return;if(!/\.(xlsb|xlsx)$/i.test(file.name)){await showNotice("warning","รองรับเฉพาะไฟล์ XLSB และ XLSX");return}appointmentClearResult();appointmentStopWorker();appointmentSetBusy(true,"กำลังอ่านข้อมูล");
  try{const buffer=await file.arrayBuffer(),worker=new Worker("./appointment-excel-worker.js?v=20260818-r179");appointmentUploadState.worker=worker;worker.onmessage=async event=>{const m=event.data||{};if(m.type==="PROGRESS")appointmentSetBusy(true,m.message||"กำลังตรวจข้อมูล");if(m.type==="ERROR"){appointmentStopWorker();appointmentSetBusy(false);await showNotice("error",m.message||"อ่านไฟล์ไม่สำเร็จ")}if(m.type==="RESULT"){appointmentStopWorker();appointmentSetBusy(false);appointmentUploadState.result=m.result;appointmentUploadState.preview=null;appointmentRenderResult()}};worker.onerror=async event=>{appointmentStopWorker();appointmentSetBusy(false);await showNotice("error",event.message||"อ่านไฟล์ไม่สำเร็จ")};worker.postMessage({type:"PARSE",buffer,fileName:file.name,config:appointmentUploadState.config?.parserConfig||{}},[buffer])}catch(error){appointmentSetBusy(false);await showNotice("error",error.message||"เปิดไฟล์ไม่สำเร็จ")}
}
function appointmentRenderResult(){const r=appointmentUploadState.result;if(!r)return;$("appointmentUploadResult").hidden=false;$("appointmentSourceRows").textContent=Number(r.stats?.sourceRows||0).toLocaleString();$("appointmentWarehouseRows").textContent=Number(r.stats?.warehouseRows||0).toLocaleString();$("appointmentTotalCount").textContent=Number(r.totalAppointments||0).toLocaleString();const issues=appointmentIssueCount();$("appointmentIssueTotal").textContent=issues.toLocaleString();$("appointmentSelectedFile").textContent=r.fileName||"-";$("appointmentFileRange").textContent=r.dateRange?.length?`${appointmentDisplayDate(r.dateRange[0])} – ${appointmentDisplayDate(r.dateRange[1])} · ${r.sourceSheet}`:r.sourceSheet||"-";const status=$("appointmentFileStatus"),empty=Number(r.totalAppointments||0)===0;status.textContent=issues?"มีรายการต้องตรวจ":empty?"ไม่พบข้อมูลของคลัง":"พร้อมนำเข้า";status.classList.toggle("warn",!!issues||empty);$("appointmentSnapshotInput").value=appointmentInferSnapshot(r.fileName);$("appointmentIssuePanel").hidden=!issues;$("appointmentImportPanel").hidden=!!issues||empty;appointmentRenderPreview();appointmentRenderIssues();window.scrollTo({top:0,behavior:"smooth"})}
function appointmentRenderPreview(){const r=appointmentUploadState.result,body=$("appointmentPreviewBody");if(!r||!body)return;const q=String($("appointmentSearchInput")?.value||"").trim().toLowerCase(),list=(r.appointments||[]).filter(a=>!q||[a.appointment,a.dc,a.date,...(a.vendors||[]),...(a.carriers||[]),...(a.pos||[])].join(" ").toLowerCase().includes(q)).slice(0,400);body.innerHTML=list.map(a=>`<tr class="${a.warnings?.length?"warn":""}"><td><b>${escapeHtml(a.appointment)}</b></td><td>${appointmentDisplayDate(a.date)}</td><td>${appointmentDisplayMinute(a.period)}</td><td>${appointmentDisplayMinute(a.from)}</td><td>${appointmentDisplayMinute(a.to)}</td><td>${escapeHtml((a.vendors||[]).join(" / ")||"-")}</td><td>${escapeHtml((a.carriers||[]).join(" / ")||"-")}</td><td>${Number((a.pos||[]).length).toLocaleString()}</td></tr>`).join("")||`<tr><td colspan="8" class="empty-state">ไม่พบข้อมูล</td></tr>`;$("appointmentShownCount").textContent=`แสดง ${list.length.toLocaleString()} จาก ${Number(r.totalAppointments||0).toLocaleString()} นัดหมาย`}
function appointmentRenderIssues(){const r=appointmentUploadState.result,rows=[...(r?.errors||[]).slice(0,100),...(r?.appointments||[]).filter(a=>a.warnings?.length).slice(0,100).map(a=>({row:"-",appointment:a.appointment,dc:a.dc,message:a.warnings.join(" · ")}))];$("appointmentIssueSummary").textContent=`${appointmentIssueCount().toLocaleString()} รายการ`;$("appointmentIssueRows").innerHTML=rows.map(x=>`<div><b>แถว ${escapeHtml(x.row||"-")} · ${escapeHtml(x.appointment||"-")}</b><span>${escapeHtml(x.dc||"-")} · ${escapeHtml(x.message||"")}</span></div>`).join("")}
function appointmentSnapshotForRequest(){const value=appointmentParseSnapshot($("appointmentSnapshotInput")?.value);if(!value)throw new Error("กรุณาระบุวันที่เวลาเป็น dd/MM/yyyy HH:mm:ss");return value}
function appointmentAddCounts(total,part){for(const key of["inserted","updated","unchanged","olderSkipped","conflicts"])total[key]+=Number(part?.[key]||0);return total}
function appointmentClosePreviewSwal(){try{if(window.Swal?.isVisible?.())window.Swal.close()}catch{}}
function appointmentShowPreviewLoading(total){
  if(!window.Swal?.fire)return;
  void window.Swal.fire({
    title:"กำลังตรวจการเปลี่ยนแปลง",
    text:`กำลังตรวจ ${Number(total||0).toLocaleString()} นัดหมาย`,
    allowOutsideClick:false,
    allowEscapeKey:false,
    showConfirmButton:false,
    didOpen:()=>window.Swal.showLoading(),
    customClass:swalClasses(),
    buttonsStyling:false,
    width:360
  });
}
async function appointmentPreviewSummaryModal(total,{blocked,canRecord,hasRowChanges,advancesSnapshot}){
  if(!window.Swal?.fire)throw new Error("ไม่สามารถเปิดหน้าต่างสรุปผลได้ กรุณารีเฟรชหน้าแล้วลองใหม่");
  appointmentClosePreviewSwal();
  const title=blocked?"ยังไม่พร้อมนำเข้า":hasRowChanges?"พร้อมนำเข้า":advancesSnapshot?"พร้อมบันทึกชุดใหม่":"ไม่มีข้อมูลเปลี่ยนแปลง";
  return await window.Swal.fire({
    icon:blocked?"warning":canRecord?"success":"info",
    title,
    html:appointmentCountsHtml(total),
    confirmButtonText:"ตกลง",
    allowOutsideClick:false,
    allowEscapeKey:false,
    customClass:swalClasses(),
    buttonsStyling:false,
    width:400
  });
}
async function appointmentPreviewChanges(){
  const r=appointmentUploadState.result;
  if(!r||appointmentIssueCount()>0||Number(r.totalAppointments||0)===0||appointmentUploadState.busy)return;
  let snapshot;
  try{snapshot=appointmentSnapshotForRequest()}catch(error){await showNotice("warning",error.message);return}
  appointmentUploadState.preview=null;
  appointmentSetBusy(true,"กำลังตรวจการเปลี่ยนแปลง");
  const items=(r.appointments||[]).map(appointmentImportItem);
  appointmentShowPreviewLoading(items.length);
  try{
    // Preview is read-only. Send a large preview chunk so a 270-row file does not require 14 sequential HTTP requests.
    const previewBatchSize=Math.max(100,Math.min(450,Number(appointmentUploadState.config?.previewBatchSize)||450));
    const total={inserted:0,updated:0,unchanged:0,olderSkipped:0,conflicts:0};
    for(let offset=0;offset<items.length;offset+=previewBatchSize){
      const batch=items.slice(offset,offset+previewBatchSize);
      const part=await api("/api/appointment/import/preview",{method:"POST",body:{...snapshot,items:batch},timeoutMs:30000});
      if(part.blockedOlder)throw new Error(part.message||"ชุดข้อมูลนี้เก่ากว่าข้อมูลปัจจุบัน");
      appointmentAddCounts(total,part.counts);
    }
    appointmentClosePreviewSwal();
    const latestKey=Number(appointmentUploadState.config?.schema?.latest?.snapshotKey||0),incomingKey=appointmentSnapshotNumericKey(snapshot),advancesSnapshot=incomingKey>latestKey;
    const blocked=total.olderSkipped>0||total.conflicts>0,hasRowChanges=total.inserted+total.updated>0,canRecord=hasRowChanges||advancesSnapshot;
    appointmentUploadState.preview={fileHash:r.fileHash,snapshotKey:`${snapshot.snapshotDate}|${snapshot.snapshotTime}`,counts:total,advancesSnapshot,acknowledged:false,canImport:!blocked&&canRecord};
    appointmentSetBusy(false);
    const modal=await appointmentPreviewSummaryModal(total,{blocked,canRecord,hasRowChanges,advancesSnapshot});
    appointmentUploadState.preview.acknowledged=Boolean(modal?.isConfirmed);
    appointmentSetBusy(false);
  }catch(error){
    appointmentClosePreviewSwal();
    appointmentUploadState.preview=null;
    appointmentSetBusy(false);
    await showNotice("error",error.message||"ตรวจการเปลี่ยนแปลงไม่สำเร็จ");
  }
}
async function appointmentImportData(){const r=appointmentUploadState.result;if(!r||appointmentIssueCount()>0)return;let snapshot;try{snapshot=appointmentSnapshotForRequest()}catch(error){await showNotice("warning",error.message);return}const preview=appointmentUploadState.preview;if(!preview||preview.fileHash!==r.fileHash||preview.snapshotKey!==`${snapshot.snapshotDate}|${snapshot.snapshotTime}`||preview.acknowledged!==true){await showNotice("warning","กรุณาตรวจการเปลี่ยนแปลงและกดตกลงที่หน้าสรุปก่อนนำเข้า");return}if(preview.counts.olderSkipped>0||preview.counts.conflicts>0){await showNotice("warning","ยังมีรายการที่ต้องตรวจ จึงยังนำเข้าไม่ได้");return}if(preview.counts.inserted+preview.counts.updated===0&&!preview.advancesSnapshot){await showNotice("info","ข้อมูลทั้งหมดตรงกับข้อมูลปัจจุบันแล้ว");return}const confirm=await Swal.fire({icon:"question",title:"ยืนยันนำเข้าข้อมูล?",html:appointmentCountsHtml(preview.counts),showCancelButton:true,confirmButtonText:"ยืนยันนำเข้า",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:400});if(!confirm.isConfirmed)return;const button=$("appointmentConfirmImport");button.disabled=true;try{appointmentSetBusy(true,"กำลังเตรียมนำเข้า");const start=await api("/api/appointment/import/start",{method:"POST",body:{fileHash:r.fileHash,fileName:r.fileName,sourceSheet:r.sourceSheet,dateFrom:r.dateRange?.[0]||null,dateTo:r.dateRange?.[1]||null,totalAppointments:r.totalAppointments,warehouseRule:appointmentUploadState.config?.parserConfig?.warehouse||{},timeReference:appointmentUploadState.config?.appointmentModule?.timeReference||"PERIOD",...snapshot},timeoutMs:45000});if(start.duplicate&&start.status==="COMPLETE"){appointmentSetBusy(false);await Swal.fire({icon:"info",title:"ไฟล์นี้เคยนำเข้าแล้ว",html:appointmentCountsHtml(start.counts),confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:400});return}const items=(r.appointments||[]).map(appointmentImportItem),batchSize=Math.max(10,Math.min(20,Number(appointmentUploadState.config?.batchSize)||20));let batchNo=Number(start.nextBatch||0);for(let offset=batchNo*batchSize;offset<items.length;offset+=batchSize,batchNo++){const batch=items.slice(offset,offset+batchSize);appointmentSetBusy(true,`กำลังบันทึก ${Math.min(offset+batch.length,items.length).toLocaleString()} / ${items.length.toLocaleString()}`);await api("/api/appointment/import/batch",{method:"POST",body:{importId:start.importId,batchNo,items:batch},timeoutMs:60000})}const done=await api("/api/appointment/import/complete",{method:"POST",body:{importId:start.importId},timeoutMs:45000});appointmentSetBusy(false);appointmentUploadState.preview=null;$("appointmentConfirmImport").disabled=true;const refreshed=await api("/api/appointment/upload-config");appointmentUploadState.config=refreshed;const latest=refreshed.schema?.latest;if(latest){$("appointmentLatestSnapshot").textContent=appointmentDisplaySnapshot(latest.snapshotDate,latest.snapshotTime);$("appointmentLatestFile").textContent=latest.fileName||"-"}await Swal.fire({icon:"success",title:"นำเข้าข้อมูลเรียบร้อย",html:appointmentCountsHtml(done.counts),confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:400})}catch(error){appointmentSetBusy(false);await showNotice("error",error.message)}finally{button.disabled=!appointmentUploadState.preview}}

async function renderAdmin() {
  if(state.user?.accessRights!=="ADMIN"){return navigate(state.user?.accessRights==="INBOUND"?"inbound":"operations")}
  $("pageContent").innerHTML=`<div class="loading">กำลังโหลดการตั้งค่าระบบ</div>`;
  try{adminState.data=await api("/api/admin/settings");renderAdminShell()}catch(error){
    try{adminHealthState.data=await api("/api/admin/diagnostics");adminHealthState.error="";adminState.data={};adminState.tab="health";renderAdminShell()}
    catch{ $("pageContent").innerHTML=`<div class="empty-state"><b>โหลดการตั้งค่าไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="retryAdmin" class="primary">ลองใหม่</button></div>`;$("retryAdmin")?.addEventListener("click",renderAdmin) }
  }
}

const ADMIN_SETTING_CATEGORIES=[
  {id:"users",label:"ผู้ใช้งาน",group:"ผู้ใช้และสิทธิ์",keywords:"บัญชี สิทธิ์ รหัสผ่าน admin user"},
  {id:"display",label:"การแสดงผล",group:"หน้าจอและเมนู",keywords:"dashboard datatable เมนู เปิด ปิด หน้าจอ"},
  {id:"health",label:"ตรวจระบบ",group:"ดูแลระบบ",keywords:"ตรวจระบบ สุขภาพ diagnostics health sync database เสถียร ซ่อม"},
  {id:"appointment",label:"เลขนัดหมาย",group:"ข้อมูลและรายงาน",keywords:"เลขนัดหมาย appointment จำนวนหลัก รูปแบบ เลขต้องห้าม ตรวจสอบ"},
  {id:"appointmentData",label:"ข้อมูลนัดหมาย",group:"ข้อมูลและรายงาน",keywords:"appointment excel upload นำเข้า แผน นัดหมาย carrier po period from"},
  {id:"workflow",label:"ขั้นตอนงาน",group:"การปฏิบัติงาน",keywords:"workflow inbound ตรวจเอกสาร รับสินค้า คืนเอกสาร ขั้นตอน"},
  {id:"doors",label:"ประตู",group:"การปฏิบัติงาน",keywords:"door R S SS RR SR RS เปิด ปิด ประตู"},
  {id:"shifts",label:"กะทำงาน",group:"เวลาและกำลังคน",keywords:"shift กะ เวลา ข้ามวัน กลางคืน"},
  {id:"alerts",label:"เวลาแจ้งเตือน",group:"เวลาและกำลังคน",keywords:"sla ปกติ เฝ้าระวัง เตือน ล่าช้า วิกฤต สี เวลา"},
  {id:"rejections",label:"ปฏิเสธรับสินค้า",group:"การปฏิบัติงาน",keywords:"reject ปฏิเสธ เหตุผล หัวหน้างาน รับทราบ"},
  {id:"recall",label:"เรียกรถซ้ำ",group:"การปฏิบัติงาน",keywords:"recall เรียกคิว เรียกรถ เปลี่ยนประตู"},
  {id:"data",label:"การใช้ข้อมูล",group:"ข้อมูลและรายงาน",keywords:"d1 database rows read write storage ข้อมูล"},
  {id:"export",label:"ส่งออกข้อมูล",group:"ข้อมูลและรายงาน",keywords:"export csv รายงาน เดือน ดาวน์โหลด"},
  {id:"tracking",label:"ติดตามคนขับ",group:"หน้าจอและเมนู",keywords:"track qr คนขับ ลิงก์ ติดตาม"},
  {id:"voice",label:"เสียงประกาศ",group:"เสียงและการแจ้งเตือน",keywords:"voice เสียง ประกาศ ความเร็ว ระดับเสียง"},
  {id:"queue",label:"จอคิว",group:"หน้าจอและเมนู",keywords:"queue จอคิว หน้าจอ เรียกรถ"}
];
function adminSettingsIcon(id){
  const icons={
    search:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/></svg>',
    users:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.5-4 2.4-6 5.5-6s5 2 5.5 6M16 9h5M18.5 6.5v5"/></svg>',
    display:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>',
    health:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h4l2-5 4 10 2-5h4"/><circle cx="12" cy="12" r="9"/></svg>',
    appointment:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 9h3M13 9h4M7 13h2M12 13h5M7 17h5"/></svg>',
    appointmentData:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M7 9h3M13 9h4M7 13h2M12 13h5M7 17h5M16 16v5M13.5 18.5H18.5"/></svg>',
    workflow:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M5 8v3c0 3 2 5 5 5h2M19 8v3c0 3-2 5-5 5h-2"/></svg>',
    doors:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h12v18H5zM9 6h5v15H9z"/><circle cx="12" cy="13" r=".8"/></svg>',
    shifts:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></svg>',
    alerts:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7M9.5 20h5"/></svg>',
    rejections:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m7 7 10 10"/></svg>',
    recall:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M18.5 12A7 7 0 0 0 6.7 7M5.5 12a7 7 0 0 0 11.8 5"/></svg>',
    data:'<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></svg>',
    export:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 19h16"/></svg>',
    tracking:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12A7 7 0 1 0 5 9c0 6.8 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    voice:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4ZM16 9c1 1 1 5 0 6M19 7c2.2 2.4 2.2 7.6 0 10"/></svg>',
    queue:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4M7 9h10M7 13h6"/></svg>'
  };
  return icons[id]||icons.workflow;
}
function renderAdminShell(){
  if(!ADMIN_SETTING_CATEGORIES.some(item=>item.id===adminState.tab))adminState.tab="users";
  const active=ADMIN_SETTING_CATEGORIES.find(item=>item.id===adminState.tab)||ADMIN_SETTING_CATEGORIES[0];
  const healthStatus=adminHealthState.data?.status||"UNKNOWN",healthLabel=healthStatus==="PASS"?"พร้อมใช้งาน":healthStatus==="WARN"?"ควรตรวจสอบ":healthStatus==="FAIL"?"มีปัญหา":"กำลังตรวจ";
  $("pageContent").innerHTML=`<section class="admin-v106">
    <header class="admin-v106-hero">
      <div><span>ศูนย์ควบคุมระบบ</span><h2>ตั้งค่าระบบ</h2><p>จัดการเมนู ขั้นตอนงาน เวลา และข้อมูลจากจุดเดียว</p></div>
      <aside id="adminHealthBadge" class="admin-v106-status health-${healthStatus.toLowerCase()}"><i></i><div><small>สถานะระบบ</small><b id="adminHealthBadgeLabel">${healthLabel}</b><span id="adminHealthBadgeTime">${adminHealthState.data?`ตรวจ ${escapeHtml(formatDate(adminHealthState.data.generatedAt))}`:"กำลังตรวจสอบ"}</span></div></aside>
    </header>
    <section class="admin-v106-toolbar">
      <label class="admin-setting-search"><span class="admin-setting-search-icon">${adminSettingsIcon("search")}</span><input id="adminSettingsSearch" type="search" autocomplete="off" placeholder="ค้นหาการตั้งค่า เช่น ประตู กะ เวลาแจ้งเตือน"></label>
      <div class="admin-v106-toolbar-info"><b id="adminCategoryCount">${ADMIN_SETTING_CATEGORIES.length}</b><span>หมวดการตั้งค่า</span></div>
    </section>
    <section class="admin-category-section">
      <header><div><b>หมวดการตั้งค่า</b><span>เลือกส่วนที่ต้องการจัดการ</span></div><small id="adminActiveGroup">${escapeHtml(active.group)}</small></header>
      <nav id="adminCategoryGrid" class="admin-category-grid" aria-label="หมวดการตั้งค่าระบบ">${ADMIN_SETTING_CATEGORIES.map(item=>`<button type="button" data-admin-tab="${item.id}" data-admin-search="${escapeHtml(`${item.label} ${item.group} ${item.keywords}`.toLowerCase())}" class="admin-category-card ${adminState.tab===item.id?"active":""}"><span class="admin-category-icon">${adminSettingsIcon(item.id)}</span><span class="admin-category-copy"><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.group)}</small></span></button>`).join("")}</nav>
      <div id="adminCategoryEmpty" class="admin-category-empty" hidden>ไม่พบหมวดการตั้งค่าที่ค้นหา</div>
    </section>
    <section class="admin-workspace-v106"><header class="admin-workspace-title"><span class="admin-category-icon active-icon">${adminSettingsIcon(active.id)}</span><div><small>${escapeHtml(active.group)}</small><b>${escapeHtml(active.label)}</b></div></header><section id="adminPanel" class="admin-panel admin-panel-v106"></section></section>
  </section>`;
  document.querySelectorAll("[data-admin-tab]").forEach(button=>button.addEventListener("click",()=>{adminState.tab=button.dataset.adminTab;try{localStorage.setItem("wvf_admin_tab",adminState.tab)}catch{}renderAdminShell()}));
  bindAdminSettingsSearch();
  renderAdminPanel();
  void ensureAdminHealth();
}
function bindAdminSettingsSearch(){
  const input=$("adminSettingsSearch"),grid=$("adminCategoryGrid"),empty=$("adminCategoryEmpty"),count=$("adminCategoryCount");
  if(!input||!grid)return;
  input.addEventListener("input",()=>{
    const query=input.value.trim().toLowerCase();let visible=0;
    grid.querySelectorAll("[data-admin-tab]").forEach(button=>{const show=!query||String(button.dataset.adminSearch||"").includes(query);button.hidden=!show;if(show)visible++});
    if(count)count.textContent=String(visible);if(empty)empty.hidden=visible!==0;
  });
  input.addEventListener("keydown",event=>{if(event.key!=="Enter")return;const visible=[...grid.querySelectorAll("[data-admin-tab]:not([hidden])")];if(visible.length===1){event.preventDefault();visible[0].click()}});
}

function renderAdminPanel(){if(adminState.tab==="users")renderAdminUsers();else if(adminState.tab==="display")renderAdminDisplay();else if(adminState.tab==="health")renderAdminDiagnostics();else if(adminState.tab==="appointment")renderAdminAppointmentValidation();else if(adminState.tab==="appointmentData")renderAdminAppointmentData();else if(adminState.tab==="workflow")renderAdminWorkflow();else if(adminState.tab==="doors")renderAdminDoors();else if(adminState.tab==="shifts")renderAdminShifts();else if(adminState.tab==="alerts")renderAdminAlerts();else if(adminState.tab==="rejections")renderAdminRejections();else if(adminState.tab==="recall")renderAdminQueueRecall();else if(adminState.tab==="data")renderAdminDataUsage();else if(adminState.tab==="export")renderAdminMonthlyExport();else if(adminState.tab==="tracking")renderAdminTracking();else if(adminState.tab==="voice")renderAdminVoice();else renderAdminQueue()}

function renderAdminDisplay(){
  const display=normalizeDisplaySettings(adminState.data?.display),vehicleExclusion=adminState.data?.vehicleExclusion||{userEnabled:true};
  $("adminPanel").innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>การแสดงผลและสิทธิ์ผู้ใช้งาน</h3><p>ควบคุมเมนูหลักและสิทธิ์ USER สำหรับจัดการข้อมูล Gate In ที่ผิดหรือซ้ำ</p></div></div><form id="displaySettingsForm" class="display-settings-form"><section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">▥</span><div><b>Dashboard</b><small>หน้าสรุปภาพรวมและข้อมูลสำหรับติดตามการปฏิบัติงาน</small></div></div><label class="clean-toggle"><input id="displayDashboard" type="checkbox" ${display.dashboardEnabled?"checked":""}><span></span></label></section><section class="display-setting-card"><div><span class="display-setting-icon datatable-icon">▤</span><div><b>Datatable</b><small>หน้าข้อมูลรายละเอียด การค้นหา การสั่งการ และการเปรียบเทียบ</small></div></div><label class="clean-toggle"><input id="displayDatatable" type="checkbox" ${display.datatableEnabled?"checked":""}><span></span></label></section><section class="display-setting-card vehicle-exclusion-setting-card"><div><span class="display-setting-icon exclusion-icon">×</span><div><b>USER นำรายการที่ผิดออก</b><small>อนุญาต USER เลือกนำข้อมูล Gate In ที่ผิด ซ้ำ หรือกรอกผิดออกได้เอง ก่อนเริ่มขั้นตอนงานต่อ</small></div></div><label class="clean-toggle"><input id="userVehicleExclusionEnabled" type="checkbox" ${vehicleExclusion.userEnabled!==false?"checked":""}><span></span></label></section><div class="display-setting-note"><b>การนำรายการออก</b><span>ไม่แก้ไข Sheet1 และไม่ลบประวัติการนำออก ระบบกัน Auto ID นั้นไม่ให้กลับเข้ามาจากการ Sync จนกว่าจะกดคืนรายการ</span></div><div class="admin-form-actions"><button class="primary" type="submit">บันทึกการตั้งค่า</button></div></form>`;
  $("displaySettingsForm")?.addEventListener("submit",async event=>{event.preventDefault();if(adminState.busy)return;adminState.busy=true;try{const [displayResult,exclusionResult]=await Promise.all([api("/api/admin/display",{method:"POST",body:{dashboardEnabled:$("displayDashboard").checked,datatableEnabled:$("displayDatatable").checked}}),api("/api/admin/vehicle-exclusion",{method:"POST",body:{userEnabled:$("userVehicleExclusionEnabled").checked}})]);state.display=normalizeDisplaySettings(displayResult.display);adminState.data.display=displayResult.display;adminState.data.vehicleExclusion=exclusionResult.vehicleExclusion;datatableState.meta=null;renderNavigation();await Swal.fire({icon:"success",title:"บันทึกการตั้งค่าแล้ว",timer:1500,showConfirmButton:false,customClass:swalClasses(),width:360})}catch(error){await showNotice("error",error.message||"บันทึกการตั้งค่าไม่สำเร็จ")}finally{adminState.busy=false}});
}


function appointmentAdminList(value){return String(value||"").split(/[\n,;|]+/).map(v=>v.trim()).filter(Boolean)}
function renderAdminAppointmentData(){
  const cfg=adminState.data?.appointmentModule||{moduleEnabled:false,uploadEnabled:false,useImportedData:false,timeReference:"PERIOD",searchWindowHours:36,adapterTimeoutMs:250,display:{},uploadProfile:{}},schema=adminState.data?.appointmentSchema||{ready:false,tablesReady:0,tablesTotal:5,indexReady:false,latest:null},kpiSchema=adminState.data?.appointmentKpiSchema||{ready:false,tablesReady:0,tablesTotal:3,indexesReady:0,indexesTotal:3,metrics:0,policy:null,lastRun:null},profile=cfg.uploadProfile||{};
  const pages=[["inbound","Inbound"],["receiving","Receiving"],["datatable","Datatable"],["dashboard","Dashboard"],["queue","จอคิว"],["track","Track"]],latest=schema.latest,fields=profile.fields||{},fieldRows=[["dc","รหัสคลัง","DC CODE"],["date","วันที่นัด","DATE"],["period","รอบนัดหมาย","PERIOD"],["from","เวลาเริ่ม","FROM"],["to","เวลาสิ้นสุด","TO"],["po","เลข PO","PO NBR"],["appointment","Appointment","APPTNBR"],["vendor","บริษัท / Vendor","VEND NAME"],["carrier","Carrier / ผู้ขนส่ง","CARR"]];
  const pageCards=pages.map(([key,label])=>{const p=cfg.display?.[key]||{};return`<section class="display-setting-card appointment-display-page" data-appointment-page="${key}"><div><div><b>${label}</b><small>กำหนดข้อมูลนัดหมายที่อนุญาตให้แสดงในหน้านี้</small></div></div><div class="appointment-display-checks"><label class="clean-check"><input data-ap-field="enabled" type="checkbox" ${p.enabled!==false?"checked":""}><span>แสดง</span></label><label class="clean-check"><input data-ap-field="timing" type="checkbox" ${p.timing!==false?"checked":""}><span>เวลา / ก่อน-ช้า</span></label><label class="clean-check"><input data-ap-field="vendor" type="checkbox" ${p.vendor?"checked":""}><span>บริษัท</span></label><label class="clean-check"><input data-ap-field="carrier" type="checkbox" ${p.carrier?"checked":""}><span>Carrier</span></label><label class="clean-check"><input data-ap-field="po" type="checkbox" ${p.po?"checked":""}><span>PO</span></label></div></section>`}).join("");
  const mapping=fieldRows.map(([key,label,def])=>`<div class="appointment-map-row"><b>${label}</b><input id="appointmentField_${key}" value="${escapeHtml(fields[key]?.header||def)}"><input id="appointmentAlias_${key}" value="${escapeHtml((fields[key]?.aliases||[]).join(", "))}" placeholder="ชื่อสำรอง คั่นด้วย ,"></div>`).join("");
  $("adminPanel").innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>ข้อมูลนัดหมาย</h3><p>ควบคุมการรับไฟล์และการใช้ข้อมูลกับงานจริงแยกจากกัน</p></div>${cfg.moduleEnabled&&cfg.uploadEnabled?`<button id="openAppointmentUpload" class="outline-button" type="button">เปิดหน้ารับไฟล์</button>`:""}</div><section class="system-health-summary ${schema.ready?"pass":"warn"}"><div><small>ฐานข้อมูลนัดหมาย</small><b>${schema.ready?"พร้อม":"ยังไม่พร้อม"}</b><span>ตาราง ${Number(schema.tablesReady||0)}/${Number(schema.tablesTotal||5)} · Index ${schema.indexReady?"พร้อม":"ยังไม่มี"}</span></div><div><small>ชุดข้อมูลล่าสุด</small><b>${latest?escapeHtml(appointmentDisplaySnapshot(latest.snapshotDate,latest.snapshotTime)):"ยังไม่มีข้อมูล"}</b><span>${latest?.fileName?escapeHtml(latest.fileName):"รอนำเข้าไฟล์นัดหมาย"}</span></div><div><small>KPI / Backfill</small><b>${kpiSchema.ready?"พร้อม":"ยังไม่พร้อม"}</b><span>${kpiSchema.ready?`บันทึกแล้ว ${Number(kpiSchema.metrics||0)} คัน · ${escapeHtml(kpiSchema.policy?.referenceMode||cfg.timeReference)}`:`ตาราง ${Number(kpiSchema.tablesReady||0)}/${Number(kpiSchema.tablesTotal||3)} · Index ${Number(kpiSchema.indexesReady||0)}/${Number(kpiSchema.indexesTotal||3)}`}</span></div></section><form id="appointmentModuleForm" class="display-settings-form"><section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">A</span><div><b>เปิดโมดูลข้อมูลนัดหมาย</b><small>เมื่อปิด ระบบหลักทำงานแบบเดิมและไม่ค้นข้อมูลนัดหมาย</small></div></div><label class="clean-toggle"><input id="appointmentModuleEnabled" type="checkbox" ${cfg.moduleEnabled?"checked":""}><span></span></label></section><section class="display-setting-card"><div><span class="display-setting-icon datatable-icon">↑</span><div><b>เปิดการอัปโหลดไฟล์</b><small>ADMIN และ USER จะเห็นเมนูข้อมูลนัดหมายและสามารถนำเข้าไฟล์ได้</small></div></div><label class="clean-toggle"><input id="appointmentUploadEnabled" type="checkbox" ${cfg.uploadEnabled?"checked":""}><span></span></label></section><section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">↔</span><div><b>ใช้ข้อมูลนัดหมายกับงานจริง</b><small>ควรเปิดหลังตรวจการนำเข้าข้อมูล Production ผ่านแล้วเท่านั้น</small></div></div><label class="clean-toggle"><input id="appointmentUseImportedData" type="checkbox" ${cfg.useImportedData?"checked":""}><span></span></label></section><div class="appointment-rule-grid"><label><span>เวลาอ้างอิง</span><select id="appointmentTimeReference"><option value="PERIOD">PERIOD</option><option value="FROM">FROM</option></select><small>ใช้คำนวณมาก่อน / ช้า · ประวัติ KPI เก่าจะไม่ถูกคำนวณใหม่อัตโนมัติ</small></label><label><span>ช่วงค้นหานัดหมาย</span><input id="appointmentSearchWindow" type="number" min="1" max="168" value="${Number(cfg.searchWindowHours||36)}"><small>ชั่วโมง</small></label><label><span>เวลารอข้อมูลสูงสุด</span><input id="appointmentAdapterTimeout" type="number" min="50" max="2000" step="10" value="${Number(cfg.adapterTimeoutMs||250)}"><small>มิลลิวินาที</small></label></div><details class="appointment-admin-file-settings"><summary><b>การอ่านไฟล์จากส่วนกลาง</b><span>ชื่อชีท รหัสคลัง และชื่อคอลัมน์</span></summary><div class="appointment-admin-file-body"><div class="appointment-rule-grid"><label><span>ชื่อชีท</span><input id="appointmentSheetName" value="${escapeHtml(profile.sheetName||"raw_data")}"></label><label><span>ชื่อชีทสำรอง</span><input id="appointmentSheetAliases" value="${escapeHtml((profile.sheetAliases||["RAW_DATA","Raw Data"]).join(", "))}"></label><label><span>วิธีเลือกรหัสคลัง</span><select id="appointmentWarehouseMode"><option value="STARTS_WITH">ขึ้นต้นด้วย</option><option value="EXACT">ตรงกับ</option></select></label><label><span>รหัสคลัง</span><input id="appointmentWarehouseValues" value="${escapeHtml((profile.warehouse?.values||["906"]).join(", "))}"></label></div><div class="appointment-map-head"><b>ข้อมูล</b><b>ชื่อคอลัมน์</b><b>ชื่อสำรอง</b></div>${mapping}</div></details><div class="admin-section-head clean-admin-head"><div><h3>การแสดงข้อมูลแต่ละหน้า</h3><p>เมื่อปิดช่องใด หน้านั้นจะไม่แสดงข้อมูลส่วนนั้น</p></div></div>${pageCards}<section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">✓</span><div><b>ตรวจ Coverage และ Matching</b><small>ตรวจว่ารถจริงอยู่ในชุดนัดหมายหรือไม่ และทดสอบ Matching Engine ด้วยข้อมูล Production แบบอ่านอย่างเดียว</small></div></div><button id="appointmentShadowUatButton" class="outline-button" type="button">ทดสอบ Coverage + Matching</button></section><section class="display-setting-card"><div><span class="display-setting-icon datatable-icon">↔</span><div><b>ตรวจ Live Enrichment Wiring</b><small>ตรวจเส้นทางข้อมูลจริง Inbound / Receiving โดยยังไม่ต้องเปิดใช้ข้อมูลนัดหมายกับงานจริง</small></div></div><button id="appointmentLiveWiringUatButton" class="outline-button" type="button">ทดสอบ Live Wiring</button></section><section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">▦</span><div><b>ตรวจการแสดงผล 6 หน้า</b><small>ตรวจสิทธิ์การแสดง เวลา บริษัท Carrier และ PO ตามค่าที่ Admin กำหนด โดยไม่ต้องเปิดใช้งานกับงานจริง</small></div></div><button id="appointmentDisplayUatButton" class="outline-button" type="button">ทดสอบการแสดงผล 6 หน้า</button></section><section class="display-setting-card"><div><span class="display-setting-icon dashboard-icon">Σ</span><div><b>ตรวจ Plan vs Actual / KPI / Backfill</b><small>ตรวจการคำนวณก่อน-ตรงเวลา-ช้า บันทึกนโยบายเวลา และประมวลผลย้อนหลังโดยไม่แก้ Gate In</small></div></div><button id="appointmentKpiUatButton" class="outline-button" type="button">ทดสอบ KPI + Backfill</button></section><div class="display-setting-note"><b>ความปลอดภัยของการเปิดใช้งาน</b><span>เปิดโมดูลและอัปโหลดได้โดยยังคง “ใช้ข้อมูลนัดหมายกับงานจริง” เป็นปิด การนำเข้าไฟล์จะไม่เปลี่ยน Gate In</span></div><div class="admin-form-actions"><button class="primary" type="submit">บันทึกการตั้งค่า</button></div></form>`;
  $("appointmentTimeReference").value=cfg.timeReference==="FROM"?"FROM":"PERIOD";$("appointmentWarehouseMode").value=profile.warehouse?.matchMode==="EXACT"?"EXACT":"STARTS_WITH";
  const sync=()=>{const on=$("appointmentModuleEnabled").checked;$("appointmentUploadEnabled").disabled=!on;$("appointmentUseImportedData").disabled=!on;document.querySelectorAll("#appointmentModuleForm select,#appointmentModuleForm input[type=number],[data-appointment-page] input,.appointment-admin-file-settings input,.appointment-admin-file-settings select").forEach(el=>el.disabled=!on);if(!on){$("appointmentUploadEnabled").checked=false;$("appointmentUseImportedData").checked=false}};$("appointmentModuleEnabled")?.addEventListener("change",sync);sync();
  $("openAppointmentUpload")?.addEventListener("click",()=>navigate("appointmentUpload"));
  $("appointmentShadowUatButton")?.addEventListener("click",appointmentRunShadowUat);
  $("appointmentLiveWiringUatButton")?.addEventListener("click",appointmentRunLiveWiringUat);$("appointmentDisplayUatButton")?.addEventListener("click",appointmentRunDisplayUat);$("appointmentKpiUatButton")?.addEventListener("click",appointmentRunKpiUat);
  $("appointmentModuleForm")?.addEventListener("submit",async event=>{event.preventDefault();if(adminState.busy)return;const display={};document.querySelectorAll("[data-appointment-page]").forEach(card=>{const key=card.dataset.appointmentPage,read=f=>card.querySelector(`[data-ap-field="${f}"]`)?.checked===true;display[key]={enabled:read("enabled"),timing:read("timing"),vendor:read("vendor"),carrier:read("carrier"),po:read("po")}});const uploadFields={};for(const[key,,def]of fieldRows)uploadFields[key]={header:String($("appointmentField_"+key)?.value||def).trim()||def,aliases:appointmentAdminList($("appointmentAlias_"+key)?.value)};const body={moduleEnabled:$("appointmentModuleEnabled").checked,uploadEnabled:$("appointmentUploadEnabled").checked,useImportedData:$("appointmentUseImportedData").checked,timeReference:$("appointmentTimeReference").value,searchWindowHours:Number($("appointmentSearchWindow").value),adapterTimeoutMs:Number($("appointmentAdapterTimeout").value),display,uploadProfile:{sheetName:String($("appointmentSheetName").value||"raw_data").trim()||"raw_data",sheetAliases:appointmentAdminList($("appointmentSheetAliases").value),warehouse:{matchMode:$("appointmentWarehouseMode").value,values:appointmentAdminList($("appointmentWarehouseValues").value)},fields:uploadFields}};adminState.busy=true;try{const result=await api("/api/admin/appointment-module",{method:"POST",body});state.appointment=normalizeAppointmentAccess(result.appointmentModule);renderNavigation();adminState.data=await api("/api/admin/settings");renderAdminShell();await Swal.fire({icon:"success",title:result.message||"บันทึกแล้ว",timer:1600,showConfirmButton:false,customClass:swalClasses(),width:380})}catch(error){await showNotice("error",error.message||"บันทึกข้อมูลนัดหมายไม่สำเร็จ")}finally{adminState.busy=false}})
}




function appointmentKpiUatHtml(data){
  const s=data?.summary||{},policy=data?.policy||{},b=data?.backfill||{},k=data?.kpi||{},tests=Array.isArray(data?.tests)?data.tests:[],math=Array.isArray(data?.mathTests)?data.mathTests:[];
  const head=`<div class="appointment-swal-counts"><span><small>ผ่าน</small><b>${Number(s.passed||0)}/${Number(s.total||0)}</b></span><span><small>Backfill</small><b>${Number(b.matched||0)} คัน</b></span><span><small>Gate In ถูกแก้</small><b>${Number(data?.gateInWriteCount||0)}</b></span></div>`;
  const policyHtml=`<div class="appointment-kpi-policy"><b>นโยบาย KPI: ${escapeHtml(policy.referenceMode||'-')}</b><span>ช่วงค้นหา ${Number(policy.searchWindowHours||0)} ชม. · เริ่ม ${escapeHtml(policy.effectiveAtDisplay||'-')}</span><small>หาก Admin เปลี่ยน PERIOD / FROM ระบบสร้างนโยบายใหม่ แต่ไม่คำนวณประวัติเก่าทับเอง</small></div>`;
  const testRows=tests.map(t=>`<div class="appointment-display-uat-row ${t.passed?'pass':'fail'}"><div><b>${escapeHtml(t.label||t.id||'-')}</b></div><strong>${t.passed?'ผ่าน':'ต้องแก้'}</strong></div>`).join('');
  const mathRows=math.map(t=>`<span class="${t.passed?'pass':'fail'}"><small>${escapeHtml(t.label||'-')}</small><b>${escapeHtml(t.status||'-')}</b></span>`).join('');
  const backfill=`<div class="appointment-kpi-backfill"><b>Backfill ข้อมูลจริง</b><span>ตรวจ ${Number(b.scanned||0)} · จับคู่ ${Number(b.matched||0)} · เพิ่ม ${Number(b.inserted||0)} · ปรับ ${Number(b.updated||0)} · เดิม ${Number(b.unchanged||0)}</span>${Number(b.policySkipped||0)>0?`<small>ข้าม ${Number(b.policySkipped||0)} รายการ เพราะเป็น KPI จากนโยบายเดิม</small>`:''}</div>`;
  const kpiHtml=`<div class="appointment-swal-counts" style="margin-top:10px"><span><small>มาก่อน</small><b>${Number(k.early||0)}</b></span><span><small>ตรงเวลา</small><b>${Number(k.onTime||0)}</b></span><span><small>ช้า</small><b>${Number(k.late||0)}</b></span></div>`;
  return`<div class="appointment-kpi-uat">${head}${policyHtml}<div class="appointment-kpi-math">${mathRows}</div>${testRows}${backfill}${kpiHtml}<div class="appointment-kpi-note">วันที่เวลา ${escapeHtml(data?.dateTimeStandard||'dd/MM/yyyy HH:mm:ss')} · Backfill เขียนเฉพาะตาราง KPI ไม่แก้ vehicles / Gate In</div></div>`;
}
async function appointmentRunKpiUat(){if(adminState.busy)return;const button=$("appointmentKpiUatButton");adminState.busy=true;if(button)button.disabled=true;try{Swal.fire({title:"กำลังตรวจ KPI และ Backfill",text:"ใช้ข้อมูล Production จริง แต่ไม่แก้ Gate In",allowOutsideClick:false,allowEscapeKey:false,showConfirmButton:false,didOpen:()=>Swal.showLoading(),customClass:swalClasses(),width:410});const data=await api("/api/admin/appointment-kpi-uat",{method:"POST",body:{}});if(!data.ready){await Swal.fire({icon:"info",title:"ยังทดสอบไม่ได้",text:data.message||"ข้อมูลยังไม่พร้อม",confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:410});return}const pass=data?.summary?.allPassed===true;await Swal.fire({icon:pass?"success":"warning",title:pass?"KPI และ Backfill ผ่าน":"มีรายการต้องตรวจ",html:appointmentKpiUatHtml(data),confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:500,heightAuto:false});adminState.data=await api("/api/admin/settings");renderAdminAppointmentData();}catch(error){try{Swal.close()}catch{}await showNotice("error",error.message||"ทดสอบ KPI / Backfill ไม่สำเร็จ")}finally{adminState.busy=false;if(button)button.disabled=false}}

function appointmentDisplayUatHtml(data){const tests=Array.isArray(data?.tests)?data.tests:[],summary=data?.summary||{},sample=data?.sample||{};return`<div class="appointment-display-uat"><div class="appointment-swal-counts"><span><small>ผ่าน</small><b>${Number(summary.passed||0)}/${Number(summary.total||0)}</b></span><span><small>เวลาสูงสุด</small><b>${Math.round(Number(summary.maxLookupMs||0))} ms</b></span><span><small>เป้าหมาย</small><b>≤ ${Number(summary.targetMs||150)} ms</b></span></div><div class="appointment-display-uat-sample"><b>ตัวอย่าง ${escapeHtml(sample.appointmentNo||'-')}</b><span>${escapeHtml(sample.plannedAtDisplay||'-')} · อ้างอิง ${escapeHtml(sample.referenceMode||'-')}</span></div>${tests.map(test=>{const p=test.policy||{},projection=test.projection||{},allowed=[p.timing?"เวลา":"",p.vendor?"บริษัท":"",p.carrier?"Carrier":"",p.po?"PO":""].filter(Boolean).join(" · ")||"ไม่แสดงรายละเอียด";const preview=test.enabled?appointmentProjectionBits(projection).join(" · "):"ปิดการแสดงผลตามค่าของ Admin";return`<div class="appointment-display-uat-row ${test.passed?"pass":"fail"}"><div><b>${escapeHtml(test.label||test.page)}</b><small>${escapeHtml(allowed)}</small><span>${escapeHtml(preview||"-")}</span></div><strong>${test.passed?"ผ่าน":"ต้องแก้"}</strong></div>`}).join("")}</div>`}
async function appointmentRunDisplayUat(){if(adminState.busy)return;adminState.busy=true;try{Swal.fire({title:"กำลังตรวจการแสดงผล",text:"ตรวจทั้ง 6 หน้าโดยไม่เปิดใช้งานกับงานจริง",allowOutsideClick:false,allowEscapeKey:false,showConfirmButton:false,didOpen:()=>Swal.showLoading(),customClass:swalClasses(),width:390});const data=await api("/api/admin/appointment-display-uat",{method:"POST",body:{}});if(!data.ready){await Swal.fire({icon:"info",title:"ยังทดสอบไม่ได้",text:data.message||"ข้อมูลยังไม่พร้อม",confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:390});return}await Swal.fire({icon:data.summary?.allPassed?"success":"warning",title:data.summary?.allPassed?"การแสดงผลผ่านครบ 6/6":"มีหน้าที่ต้องตรวจ",html:appointmentDisplayUatHtml(data),confirmButtonText:"ตกลง",customClass:{...swalClasses(),popup:"wfv-swal appointment-display-uat-swal"},buttonsStyling:false,width:520})}catch(error){await showNotice("error",error.message||"ทดสอบการแสดงผลไม่สำเร็จ")}finally{adminState.busy=false}}

function appointmentCoverageUatHtml(data){
  const c=data?.coverage||{},d=data?.deterministic||{},p=data?.performance||{},actual=(data?.actualSamples?.matched||[]).slice(0,2),notMatched=(data?.actualSamples?.notMatched||[]).slice(0,2);
  const coverage=`<div class="appointment-swal-counts"><span><small>Gate In ที่ตรวจ</small><b>${Number(c.vehiclesChecked||0)}</b></span><span><small>อยู่ในชุดนัด</small><b>${Number(c.vehiclesWithNumberInPlan||0)}</b></span><span><small>จับคู่จริง</small><b>${Number(c.actualMatched||0)}</b></span></div>`;
  const dateRange=c.planDateFrom&&c.planDateTo?`${appointmentDisplayDate(c.planDateFrom)} – ${appointmentDisplayDate(c.planDateTo)}`:"-";
  const coverageNote=c.status==="NO_OVERLAP"?`<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#fff7e9;color:#915600"><b>ยังไม่มีรถที่อยู่ในชุดนัดหมายนี้</b><small style="display:block;margin-top:3px">ชุด Production ${escapeHtml(dateRange)} · ไม่ถือว่า Matching ล้มเหลว</small></div>`:`<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:#eef9f2;color:#17864b"><b>พบ Coverage จาก Gate In จริง ${Number(c.coveragePercent||0)}%</b></div>`;
  const det=`<div style="margin-top:12px;padding:10px 12px;border:1px solid #e4e9f2;border-radius:12px;text-align:left"><div style="display:flex;justify-content:space-between;gap:10px"><b>Matching Engine</b><b style="color:${d.pass?'#17864b':'#b42318'}">ผ่าน ${Number(d.passed||0)}/${Number(d.total||0)}</b></div><small style="display:block;margin-top:3px;color:#68758a">ใช้ Appointment จริง ${escapeHtml(d.sampleAppointmentNo||'-')} · ${escapeHtml(d.samplePlannedAtDisplay||'-')}</small>${(d.results||[]).map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #edf1f7"><span>${escapeHtml(x.label||x.key)}</span><b style="color:${x.pass?'#17864b':'#b42318'}">${x.pass?'ผ่าน':'ไม่ผ่าน'}</b></div>`).join('')}</div>`;
  const perf=`<div class="appointment-swal-counts" style="margin-top:10px"><span><small>Median</small><b>${Number(p.medianLookupMs||0)} ms</b></span><span><small>P95</small><b>${Number(p.p95LookupMs||0)} ms</b></span><span><small>เป้าหมาย</small><b>≤ ${Number(p.targetMs||150)} ms</b></span></div>`;
  const rows=[...actual.map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #edf1f7"><span><b>${escapeHtml(x.appointmentNo||'-')}</b><small style="display:block;color:#68758a">${escapeHtml(x.gateInAtDisplay||'-')}</small></span><b style="color:#17864b">${escapeHtml(x.timing?.deltaLabel||'พบ')}</b></div>`),...notMatched.map(x=>`<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid #edf1f7"><span><b>${escapeHtml(x.appointmentNo||'-')}</b><small style="display:block;color:#68758a">${escapeHtml(x.gateInAtDisplay||'-')}</small></span><b style="color:#9a5a00">${escapeHtml(x.reasonLabel||'ไม่พบ')}</b></div>`)].join('');
  return`${coverage}${coverageNote}${det}${perf}${rows?`<div style="margin-top:10px;text-align:left">${rows}</div>`:""}<div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:#f5f7fb;color:#68758a">อ่านข้อมูล Production เท่านั้น · ไม่สร้างรถ · ไม่เขียน Gate In · ไม่แก้ Workflow</div>`;
}
async function appointmentRunShadowUat(){
  if(adminState.busy)return;adminState.busy=true;const button=$("appointmentShadowUatButton");if(button)button.disabled=true;
  try{
    Swal.fire({title:"กำลังตรวจ Coverage และ Matching",text:"ใช้ Gate In จริงร่วมกับ Appointment ใน Production แบบอ่านอย่างเดียว",allowOutsideClick:false,allowEscapeKey:false,showConfirmButton:false,didOpen:()=>Swal.showLoading(),customClass:swalClasses(),width:410});
    const data=await api("/api/admin/appointment-coverage-uat",{method:"POST",body:{lookbackHours:48,limit:40},timeoutMs:30000});
    if(!data.ready){await Swal.fire({icon:"warning",title:"ยังทดสอบไม่ได้",text:data.message||"ข้อมูลยังไม่พร้อม",confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:390});return}
    const pass=data?.deterministic?.pass===true&&data?.performance?.pass===true,coverage=data?.coverage||{};
    const title=pass?(coverage.status==="NO_OVERLAP"?"Matching ผ่าน · รอ Coverage รถจริง":"Coverage + Matching ผ่าน"):"มีรายการต้องตรวจ";
    await Swal.fire({icon:pass?"success":"warning",title,html:appointmentCoverageUatHtml(data),confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:470,heightAuto:false});
  }catch(error){try{Swal.close()}catch{}await showNotice("error",error.message||"ทดสอบ Coverage และ Matching ไม่สำเร็จ")}finally{adminState.busy=false;if(button)button.disabled=false}
}

function appointmentLiveWiringUatHtml(data){
  const summary=data?.summary||{},tests=Array.isArray(data?.tests)?data.tests:[],sample=data?.sample||{},actual=data?.actualUseImportedData===true;
  const head=`<div class="appointment-swal-counts"><span><small>ผ่าน</small><b>${Number(summary.passed||0)}/${Number(summary.total||0)}</b></span><span><small>Matched</small><b>${Math.round(Number(summary.matchedLookupMs||0))} ms</b></span><span><small>เป้าหมาย</small><b>≤ ${Number(summary.targetMs||150)} ms</b></span></div>`;
  const setting=`<div style="margin-top:10px;padding:10px 12px;border-radius:10px;background:${actual?'#fff7e9':'#eef9f2'};color:${actual?'#915600':'#17864b'}"><b>การใช้งานกับงานจริง: ${actual?'เปิด':'ยังปิด'}</b><small style="display:block;margin-top:3px">การทดสอบนี้ไม่เปลี่ยนค่าตั้งค่าและไม่เขียน Gate In</small></div>`;
  const rows=tests.map(t=>`<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #edf1f7;text-align:left"><span><b>${escapeHtml(t.label||t.id||'-')}</b><small style="display:block;color:#68758a">${escapeHtml(t.detail||'')}</small></span><strong style="color:${t.passed?'#17864b':'#b42318'}">${t.passed?'ผ่าน':'ไม่ผ่าน'}</strong></div>`).join('');
  const sampleText=sample.appointmentNo?`<div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:#f5f7fb;color:#68758a;text-align:left"><b>ตัวอย่าง Production ${escapeHtml(sample.appointmentNo)}</b><small style="display:block;margin-top:3px">${escapeHtml(sample.plannedAtDisplay||'-')} · อ้างอิง ${escapeHtml(sample.referenceMode||'-')}</small></div>`:'';
  return`${head}${setting}<div style="margin-top:10px;padding:0 2px">${rows}</div>${sampleText}<div style="margin-top:10px;padding:9px 11px;border-radius:10px;background:#f5f7fb;color:#68758a">Live Wiring คืนข้อมูลเสริมแยกจากข้อมูลรถ · OFF แล้วไม่ Query ตาราง Appointment</div>`
}
async function appointmentRunLiveWiringUat(){
  if(adminState.busy)return;adminState.busy=true;const button=$("appointmentLiveWiringUatButton");if(button)button.disabled=true;
  try{
    Swal.fire({title:"กำลังตรวจ Live Wiring",text:"ตรวจเส้นทาง Inbound / Receiving แบบอ่านอย่างเดียว",allowOutsideClick:false,allowEscapeKey:false,showConfirmButton:false,didOpen:()=>Swal.showLoading(),customClass:swalClasses(),width:400});
    const data=await api("/api/admin/appointment-live-wiring-uat",{method:"POST",body:{},timeoutMs:30000});
    if(!data.ready){await Swal.fire({icon:"warning",title:"ยังทดสอบไม่ได้",text:data.message||"ข้อมูลยังไม่พร้อม",confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:390});return}
    const pass=data?.summary?.allPassed===true,title=pass?"Live Wiring ผ่าน":"มีรายการต้องตรวจ";
    await Swal.fire({icon:pass?"success":"warning",title,html:appointmentLiveWiringUatHtml(data),confirmButtonText:"ตกลง",customClass:swalClasses(),buttonsStyling:false,width:470,heightAuto:false});
  }catch(error){try{Swal.close()}catch{}await showNotice("error",error.message||"ทดสอบ Live Wiring ไม่สำเร็จ")}finally{adminState.busy=false;if(button)button.disabled=false}
}

function renderAdminAppointmentValidation(){
  const cfg=normalizeAppointmentValidationClient(adminState.data?.appointmentValidation||{}),lengthText=cfg.allowedLengths.join(", "),blockedText=cfg.blockedValues.join("\n");
  $("adminPanel").innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>ตรวจเลขนัดหมาย</h3><p>กำหนดรูปแบบเลขนัดหมายที่ถือว่าถูกต้อง ระบบใช้เพื่อแจ้งเตือนเท่านั้นและจะไม่นำรายการออกอัตโนมัติ</p></div></div><form id="appointmentValidationForm" class="appointment-rule-form"><section class="appointment-rule-switch"><div><b>ตรวจเลขนัดหมายอัตโนมัติ</b><small>เมื่อเปิด ระบบจะแสดงรายการที่ไม่ตรงกฎใน Datatable</small></div><label class="clean-toggle"><input id="appointmentRuleEnabled" type="checkbox" ${cfg.enabled?"checked":""}><span></span></label></section><div class="appointment-rule-grid"><label><span>จำนวนหลักที่ถูกต้อง</span><input id="appointmentRuleLengths" value="${escapeHtml(lengthText)}" placeholder="เช่น 7 หรือ 7, 9"><small>ใส่ได้หลายค่าเพื่อรองรับช่วงเปลี่ยนรูปแบบในอนาคต</small></label><section class="appointment-rule-check"><span>รูปแบบตัวเลข</span><label class="clean-check"><input id="appointmentNumericOnly" type="checkbox" ${cfg.numericOnly?"checked":""}><span>ต้องเป็นตัวเลขเท่านั้น</span></label><label class="clean-check"><input id="appointmentBlockZero" type="checkbox" ${cfg.blockAllZero?"checked":""}><span>ห้ามเป็นเลข 0 ทั้งชุด</span></label></section><label class="appointment-rule-blocked"><span>ค่าที่ห้ามใช้</span><textarea id="appointmentBlockedValues" rows="5" placeholder="ใส่ทีละบรรทัด">${escapeHtml(blockedText)}</textarea><small>เช่น -, N/A หรือเลขเฉพาะที่องค์กรไม่ใช้</small></label><section class="appointment-rule-test"><header><div><b>ทดลองตรวจ</b><small>ตรวจตัวอย่างก่อนบันทึก</small></div></header><div><input id="appointmentRuleTestValue" placeholder="กรอกเลขนัดหมายตัวอย่าง"><span id="appointmentRuleTestResult" class="appointment-rule-test-result">รอกรอกตัวอย่าง</span></div></section></div><div class="appointment-rule-note"><b>การทำงาน</b><span>รายการที่ผิดกฎจะถูกทำเครื่องหมายและกรองได้ด้วยปุ่ม “นัดหมายผิด” แต่ USER/ADMIN ยังเป็นผู้ยืนยัน “นำออก” เอง เพื่อป้องกันการลบงานจริงจากการพิมพ์ผิดเพียงอย่างเดียว</span></div><div class="admin-form-actions"><button class="primary" type="submit">บันทึกกฎเลขนัดหมาย</button></div></form>`;
  const readRules=()=>normalizeAppointmentValidationClient({enabled:$("appointmentRuleEnabled")?.checked,allowedLengths:$("appointmentRuleLengths")?.value||"",numericOnly:$("appointmentNumericOnly")?.checked,blockAllZero:$("appointmentBlockZero")?.checked,blockedValues:$("appointmentBlockedValues")?.value||""});
  const updateTest=()=>{const el=$("appointmentRuleTestResult"),value=$("appointmentRuleTestValue")?.value||"",result=appointmentValidationClient(value,readRules());if(!el)return;if(!value){el.className="appointment-rule-test-result";el.textContent="รอกรอกตัวอย่าง";return}el.className=`appointment-rule-test-result ${result.valid?"is-valid":"is-invalid"}`;el.textContent=result.valid?"ถูกต้อง":result.message||"ไม่ถูกต้อง"};
  ["appointmentRuleEnabled","appointmentRuleLengths","appointmentNumericOnly","appointmentBlockZero","appointmentBlockedValues","appointmentRuleTestValue"].forEach(id=>$(id)?.addEventListener("input",updateTest));
  $("appointmentValidationForm")?.addEventListener("submit",async event=>{event.preventDefault();if(adminState.busy)return;const rules=readRules();if(rules.enabled&&!rules.allowedLengths.length){await showNotice("warning","กรุณากำหนดจำนวนหลักที่ถูกต้องอย่างน้อย 1 ค่า");return}adminState.busy=true;try{const data=await api("/api/admin/appointment-validation",{method:"POST",body:rules});adminState.data.appointmentValidation=data.appointmentValidation;datatableState.meta=null;await Swal.fire({icon:"success",title:"บันทึกกฎแล้ว",text:"Datatable จะใช้กฎนี้ในการตรวจเลขนัดหมาย",timer:1700,showConfirmButton:false,customClass:swalClasses(),width:390});renderAdminAppointmentValidation()}catch(error){await showNotice("error",error.message||"บันทึกกฎเลขนัดหมายไม่สำเร็จ")}finally{adminState.busy=false}})
}

function renderAdminUsers(){const users=adminState.data.users||[];$("adminPanel").innerHTML=`<div class="admin-section-head"><div><h3>ผู้ใช้งานและสิทธิ์</h3><p>บัญชีที่จัดการจากหน้านี้จะไม่ถูก PASS Sheet เขียนทับ</p></div><button id="addAdminUser" class="primary">เพิ่มผู้ใช้งาน</button></div><div class="admin-table users-admin-table"><div class="admin-table-row admin-table-header"><span>ชื่อผู้ใช้</span><span>สิทธิ์</span><span>ที่มา</span><span>สถานะ</span><span></span></div>${users.map(user=>`<div class="admin-table-row"><b>${escapeHtml(user.name)}</b><span>${roleLabel(user.access_rights)}</span><span>${user.managed_source==="ADMIN"?"หน้า Admin":"PASS Sheet"}</span><span class="admin-status ${user.is_active?"on":"off"}">${user.is_active?"ใช้งาน":"ปิดใช้งาน"}</span><span class="admin-row-actions"><button data-edit-user="${escapeHtml(user.user_id)}">แก้ไข</button><button data-toggle-user="${escapeHtml(user.user_id)}">${user.is_active?"ปิด":"เปิด"}</button></span></div>`).join("")}</div>`;$("addAdminUser").addEventListener("click",()=>editAdminUser());document.querySelectorAll("[data-edit-user]").forEach(button=>button.addEventListener("click",()=>editAdminUser(users.find(user=>user.user_id===button.dataset.editUser))));document.querySelectorAll("[data-toggle-user]").forEach(button=>button.addEventListener("click",()=>toggleAdminUser(users.find(user=>user.user_id===button.dataset.toggleUser))))}

async function editAdminUser(user=null){const html=`<div class="admin-dialog-form"><label>ชื่อผู้ใช้<input id="adminUserName" value="${escapeHtml(user?.name||"")}" maxlength="120"></label><label>สิทธิ์<select id="adminUserRole"><option value="ADMIN">ผู้ดูแลระบบ</option><option value="USER">แผนกรับสินค้า</option><option value="INBOUND">แผนก Inbound</option></select></label><label>${user?"รหัสผ่านใหม่ (เว้นว่างหากไม่เปลี่ยน)":"รหัสผ่าน"}<input id="adminUserPassword" type="password" maxlength="200"></label><label class="switch-line"><input id="adminUserActive" type="checkbox" ${user?.is_active===0?"":"checked"}> เปิดใช้งาน</label></div>`;const result=await Swal.fire({title:user?"แก้ไขผู้ใช้งาน":"เพิ่มผู้ใช้งาน",html,showCancelButton:true,confirmButtonText:"บันทึก",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:440,didOpen:()=>{$("adminUserRole").value=user?.access_rights||"USER"},preConfirm:()=>({userId:user?.user_id||"",name:$("adminUserName").value.trim(),accessRights:$("adminUserRole").value,password:$("adminUserPassword").value,isActive:$("adminUserActive").checked})});if(!result.isConfirmed)return;await adminMutation("/api/admin/users/save",result.value)}
async function toggleAdminUser(user){const result=await Swal.fire({icon:"question",title:user.is_active?"ปิดใช้งานบัญชีนี้?":"เปิดใช้งานบัญชีนี้?",text:user.name,showCancelButton:true,confirmButtonText:"ยืนยัน",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:380});if(result.isConfirmed)await adminMutation("/api/admin/users/status",{userId:user.user_id,isActive:!user.is_active})}

function renderAdminWorkflow(){const w=adminState.data.workflow||{},checkOn=Number(w.use_document_check)!==0;$("adminPanel").innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>ขั้นตอนการทำงาน</h3><p>การเปลี่ยนแปลงใช้กับรถใหม่ รถที่กำลังทำงานอยู่จะยึด Workflow ที่ได้รับตอน Gate In</p></div></div><section class="workflow-preview-r88"><b>ลำดับเมื่อตั้งค่าตรวจเอกสาร</b><div><span>เข้าพื้นที่</span><i></i><span>ยื่นเอกสาร</span><i></i><span class="${checkOn?"active":"muted"}">ตรวจเอกสาร</span><i></i><span>พร้อมตรวจรับ</span><i></i><span>ตรวจรับสินค้า</span></div></section><form id="workflowForm" class="workflow-admin-grid clean-setting-grid">${workflowSwitch("wfInboundFirst","ยื่นเอกสารก่อน","ให้ Inbound บันทึกเวลาที่ผู้ขับยื่นเอกสาร",w.use_inbound_first)}${workflowSwitch("wfDocumentCheck","ตรวจเอกสารก่อนส่งเข้าตรวจรับ","หลังยื่นเอกสาร ให้รอเจ้าหน้าที่กด ตรวจเอกสารเสร็จ ก่อนขึ้นหน้า งานรับสินค้า",w.use_document_check)}${workflowSwitch("wfReceiving","ตรวจรับสินค้า","ส่งรถที่พร้อมแล้วไปยังหน้ารับสินค้า",w.use_receiving)}${workflowSwitch("wfInboundSecond","รับเอกสารคืน","ให้ Inbound บันทึกเวลารับเอกสารคืน",w.use_inbound_second)}<div class="workflow-check-note"><b>ข้อมูลเวลาที่เพิ่ม</b><span>Gate In → ยื่นเอกสาร · ยื่นเอกสาร → ตรวจเอกสารเสร็จ · ตรวจเอกสารเสร็จ → เริ่มตรวจรับ</span></div><div class="admin-form-actions"><button class="primary" type="submit">บันทึกขั้นตอนงาน</button></div></form>`;const receiving=$("wfReceiving"),inbound=$("wfInboundFirst"),check=$("wfDocumentCheck");const sync=()=>{check.disabled=!receiving.checked||!inbound.checked;if(check.disabled)check.checked=false};receiving.addEventListener("change",sync);inbound.addEventListener("change",sync);sync();$("workflowForm").addEventListener("submit",event=>{event.preventDefault();adminMutation("/api/admin/workflow",{useInboundFirst:inbound.checked,useDocumentCheck:check.checked,useReceiving:receiving.checked,useInboundSecond:$("wfInboundSecond").checked,useDoor:Number(w.use_door)!==0,requireDoor:Number(w.require_door)!==0})})}
function workflowSwitch(id,title,description,checked){return `<label class="setting-switch-card"><span><b>${title}</b><small>${description}</small></span><input id="${id}" type="checkbox" ${Number(checked)?"checked":""}></label>`}

function adminDoorIcon(type){
  const icons={
    plus:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
    search:`<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="m15 15 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
    open:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h10v16H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 7h6v13h-6z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M16 12h3m-1.4-1.4L19 12l-1.4 1.4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    close:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h11v16H6z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 7h5v13H9z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m16.2 9.2 4 4m0-4-4 4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    trash:`<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4.5h6V7M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  };return icons[type]||icons.plus;
}
function normalizeDoorEditorCode(value){
  const text=String(value||"").trim().toUpperCase(),match=text.match(/^(SS|RR|SR|RS|S|R)(\d{1,3})$/);
  if(!match)return null;return{code:match[1]+match[2],group:match[1],number:Number(match[2])};
}
function sortDoorEditorItems(items){
  const order={S:1,R:2,SS:3,RR:4,SR:5,RS:6};
  return [...items].sort((a,b)=>(order[a.group]||99)-(order[b.group]||99)||Number(a.number)-Number(b.number)||String(a.code).localeCompare(String(b.code)));
}
function renderAdminDoors(){
  const doors=adminState.data.doors||[],w=adminState.data.workflow||{},useDoor=Number(w.use_door)!==0,requireDoor=useDoor&&Number(w.require_door)!==0;
  doorEditorState.items=sortDoorEditorItems(doors.map(door=>{const parsed=normalizeDoorEditorCode(door.door_code);return parsed?{...parsed,isActive:Number(door.is_active)!==0,selected:false}:null}).filter(Boolean));
  doorEditorState.search="";doorEditorState.group="ALL";doorEditorState.status="ALL";
  $("adminPanel").innerHTML=`<form id="doorsForm" class="door-settings-form door-manager-form">
    <section class="door-master-switch ${useDoor?"is-on":"is-off"}"><div><small>การใช้งานประตูรับสินค้า</small><h3 id="doorUseTitle">${useDoor?"เปิดใช้งาน":"ปิดใช้งาน"}</h3><p id="doorUseText">${useDoor?"พนักงานเลือกได้เฉพาะประตูที่ Admin เปิดใช้งาน":"พนักงานเริ่มตรวจรับได้โดยไม่ต้องระบุประตู"}</p></div><label class="large-toggle"><input id="doorUseSwitch" type="checkbox" ${useDoor?"checked":""}><span></span></label></section>
    <section id="doorOptions" class="door-options ${useDoor?"":"is-muted"}">
      <label class="setting-switch-card compact-setting"><span><b>ต้องระบุประตู</b><small>เมื่อเปิดไว้ ระบบจะไม่ให้เรียกหรือเริ่มตรวจรับจนกว่าจะเลือกประตู</small></span><input id="doorRequiredSwitch" type="checkbox" ${requireDoor?"checked":""} ${useDoor?"":"disabled"}></label>

      <section class="door-bulk-builder">
        <header><div><h3>เพิ่มประตูแบบรวดเร็ว</h3><p>เหมาะกับคลังที่มีประตูจำนวนมาก สามารถสร้างเป็นช่วง หรือวางหลายรหัสพร้อมกัน</p></div><span id="doorTotalCount" class="clean-count"></span></header>
        <div class="door-range-grid">
          <label><span>กลุ่มประตู</span><select id="doorBulkPrefix"><option>S</option><option>R</option><option>SS</option><option>RR</option><option>SR</option><option>RS</option></select></label>
          <label><span>เริ่มเลข</span><input id="doorBulkFrom" type="number" min="0" max="999" value="1"></label>
          <label><span>ถึงเลข</span><input id="doorBulkTo" type="number" min="0" max="999" value="20"></label>
          <label><span>รูปแบบเลข</span><select id="doorBulkPad"><option value="2">2 หลัก เช่น 01</option><option value="0">ไม่เติมศูนย์</option><option value="3">3 หลัก เช่น 001</option></select></label>
          <button id="doorBulkAdd" type="button" class="primary door-icon-button">${adminDoorIcon("plus")}<span>เพิ่มช่วง</span></button>
        </div>
        <div class="door-paste-row"><label><span>เพิ่มรหัสเฉพาะ</span><input id="doorSingleInput" type="text" placeholder="เช่น R01, R05, S12"></label><button id="doorSingleAdd" type="button" class="outline-button door-icon-button">${adminDoorIcon("plus")}<span>เพิ่มรหัส</span></button></div>
      </section>

      <section class="door-manager-card">
        <header class="door-manager-head"><div><h3>จัดการประตู</h3><p>ค้นหา เลือกหลายประตู แล้วเปิด ปิด หรือลบพร้อมกันได้</p></div><span id="doorActiveCount" class="clean-count"></span></header>
        <div class="door-manager-filters">
          <label class="door-search-field"><span>${adminDoorIcon("search")}</span><input id="doorAdminSearch" type="search" placeholder="ค้นหา เช่น R12"></label>
          <select id="doorGroupFilter"><option value="ALL">ทุกกลุ่ม</option><option>S</option><option>R</option><option>SS</option><option>RR</option><option>SR</option><option>RS</option></select>
          <select id="doorStatusFilter"><option value="ALL">ทุกสถานะ</option><option value="ACTIVE">เปิดใช้งาน</option><option value="INACTIVE">ปิดใช้งาน</option></select>
        </div>
        <div class="door-bulk-actions">
          <label><input id="doorSelectVisible" type="checkbox"><span>เลือกทั้งหมดที่แสดง</span></label>
          <div>
            <button id="doorOpenSelected" type="button">${adminDoorIcon("open")}<span>เปิดที่เลือก</span></button>
            <button id="doorCloseSelected" type="button">${adminDoorIcon("close")}<span>ปิดที่เลือก</span></button>
            <button id="doorDeleteSelected" type="button" class="danger">${adminDoorIcon("trash")}<span>ลบที่เลือก</span></button>
          </div>
        </div>
        <div id="doorManagerSummary" class="door-manager-summary"></div>
        <div id="doorManagerGrid" class="door-manager-grid"></div>
      </section>
    </section>
    <div class="admin-form-actions clean-sticky-actions"><button class="primary" type="submit">บันทึกการตั้งค่าประตู</button></div>
  </form>`;

  const useSwitch=$("doorUseSwitch"),required=$("doorRequiredSwitch"),options=$("doorOptions"),title=$("doorUseTitle"),text=$("doorUseText");
  const syncMaster=()=>{const on=useSwitch.checked;required.disabled=!on;if(!on)required.checked=false;options.classList.toggle("is-muted",!on);title.textContent=on?"เปิดใช้งาน":"ปิดใช้งาน";text.textContent=on?"พนักงานเลือกได้เฉพาะประตูที่ Admin เปิดใช้งาน":"พนักงานเริ่มตรวจรับได้โดยไม่ต้องระบุประตู";useSwitch.closest(".door-master-switch")?.classList.toggle("is-on",on);useSwitch.closest(".door-master-switch")?.classList.toggle("is-off",!on)};
  useSwitch.addEventListener("change",syncMaster);syncMaster();

  $("doorAdminSearch").addEventListener("input",event=>{doorEditorState.search=String(event.target.value||"").trim().toUpperCase();renderDoorManagerGrid()});
  $("doorGroupFilter").addEventListener("change",event=>{doorEditorState.group=event.target.value;renderDoorManagerGrid()});
  $("doorStatusFilter").addEventListener("change",event=>{doorEditorState.status=event.target.value;renderDoorManagerGrid()});
  $("doorBulkAdd").addEventListener("click",addDoorRange);
  $("doorSingleAdd").addEventListener("click",addDoorCodesFromInput);
  $("doorSingleInput").addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();addDoorCodesFromInput()}});
  $("doorOpenSelected").addEventListener("click",()=>bulkDoorActive(true));
  $("doorCloseSelected").addEventListener("click",()=>bulkDoorActive(false));
  $("doorDeleteSelected").addEventListener("click",deleteSelectedDoors);
  $("doorSelectVisible").addEventListener("change",event=>{for(const item of visibleDoorEditorItems())item.selected=event.target.checked;renderDoorManagerGrid()});
  $("doorManagerGrid").addEventListener("change",event=>{
    const tile=event.target.closest("[data-door-code]");if(!tile)return;const item=doorEditorState.items.find(row=>row.code===tile.dataset.doorCode);if(!item)return;
    if(event.target.matches("[data-door-select]"))item.selected=event.target.checked;
    if(event.target.matches("[data-door-active]"))item.isActive=event.target.checked;
    renderDoorManagerGrid();
  });
  $("doorsForm").addEventListener("submit",async event=>{event.preventDefault();const rows=sortDoorEditorItems(doorEditorState.items).map(item=>({doorCode:item.code,isActive:item.isActive}));await saveDoorSettings({useDoor:useSwitch.checked,requireDoor:required.checked,doors:rows})});
  renderDoorManagerGrid();
}
function visibleDoorEditorItems(){
  const query=doorEditorState.search;
  return doorEditorState.items.filter(item=>(!query||item.code.includes(query))&&(doorEditorState.group==="ALL"||item.group===doorEditorState.group)&&(doorEditorState.status==="ALL"||(doorEditorState.status==="ACTIVE"&&item.isActive)||(doorEditorState.status==="INACTIVE"&&!item.isActive)));
}
function renderDoorManagerGrid(){
  const grid=$("doorManagerGrid");if(!grid)return;
  const visible=visibleDoorEditorItems(),active=doorEditorState.items.filter(item=>item.isActive).length,selected=doorEditorState.items.filter(item=>item.selected).length;
  $("doorTotalCount").textContent=`ทั้งหมด ${doorEditorState.items.length} ประตู`;
  $("doorActiveCount").textContent=`เปิด ${active} · ปิด ${doorEditorState.items.length-active}`;
  $("doorManagerSummary").textContent=`แสดง ${visible.length} ประตู${selected?` · เลือกไว้ ${selected}`:""}`;
  const selectVisible=$("doorSelectVisible");if(selectVisible){selectVisible.checked=Boolean(visible.length)&&visible.every(item=>item.selected);selectVisible.indeterminate=visible.some(item=>item.selected)&&!visible.every(item=>item.selected)}
  grid.innerHTML=visible.length?visible.map(item=>`<article class="door-manage-tile ${item.isActive?"is-active":"is-inactive"} ${item.selected?"is-selected":""}" data-door-code="${escapeHtml(item.code)}"><label class="door-select-box"><input type="checkbox" data-door-select ${item.selected?"checked":""}><span></span></label><div class="door-code-copy"><b>${escapeHtml(item.code)}</b><small>กลุ่ม ${escapeHtml(item.group)} · หมายเลข ${item.number}</small></div><label class="door-state-switch"><input type="checkbox" data-door-active ${item.isActive?"checked":""}><span></span><em>${item.isActive?"เปิด":"ปิด"}</em></label></article>`).join(""):`<div class="empty-state"><b>ไม่พบประตูตามตัวกรอง</b><span>ลองเปลี่ยนคำค้นหา กลุ่ม หรือสถานะ</span></div>`;
}
function addDoorRange(){
  const prefix=String($("doorBulkPrefix")?.value||"R"),from=Number($("doorBulkFrom")?.value),to=Number($("doorBulkTo")?.value),pad=Number($("doorBulkPad")?.value||0);
  if(!Number.isInteger(from)||!Number.isInteger(to)||from<0||to>999||from>to){showNotice("warning","กรุณาตรวจสอบช่วงหมายเลขประตู");return}
  const count=to-from+1;if(doorEditorState.items.length+count>1000){showNotice("warning","ระบบรองรับได้สูงสุด 1,000 ประตูต่อคลัง");return}
  const existing=new Set(doorEditorState.items.map(item=>item.code));let added=0;
  for(let n=from;n<=to;n++){const digits=pad>0?String(n).padStart(pad,"0"):String(n),parsed=normalizeDoorEditorCode(prefix+digits);if(parsed&&!existing.has(parsed.code)){doorEditorState.items.push({...parsed,isActive:true,selected:false});existing.add(parsed.code);added++}}
  doorEditorState.items=sortDoorEditorItems(doorEditorState.items);renderDoorManagerGrid();showNotice("success",added?`เพิ่ม ${added} ประตูแล้ว`:"ไม่มีประตูใหม่ให้เพิ่ม");
}
function addDoorCodesFromInput(){
  const input=$("doorSingleInput"),raw=String(input?.value||"").trim();if(!raw)return;
  const parts=raw.split(/[\s,;]+/).map(value=>value.trim()).filter(Boolean),existing=new Set(doorEditorState.items.map(item=>item.code));let added=0,invalid=[],limitReached=false;
  for(const part of parts){
    const parsed=normalizeDoorEditorCode(part);if(!parsed){invalid.push(part);continue}if(existing.has(parsed.code))continue;
    if(doorEditorState.items.length>=1000){limitReached=true;break}
    doorEditorState.items.push({...parsed,isActive:true,selected:false});existing.add(parsed.code);added++;
  }
  doorEditorState.items=sortDoorEditorItems(doorEditorState.items);if(input)input.value="";renderDoorManagerGrid();
  if(limitReached)showNotice("warning",`เพิ่ม ${added} ประตูแล้ว และหยุดที่จำนวนสูงสุด 1,000 ประตู`);
  else if(invalid.length)showNotice("warning",`เพิ่ม ${added} ประตู · ข้ามรหัสที่ไม่ถูกต้อง: ${invalid.slice(0,5).join(", ")}`);
  else showNotice("success",added?`เพิ่ม ${added} ประตูแล้ว`:"ไม่มีประตูใหม่ให้เพิ่ม");
}
function bulkDoorActive(active){
  const selected=doorEditorState.items.filter(item=>item.selected);if(!selected.length){showNotice("warning","กรุณาเลือกประตูก่อน");return}
  for(const item of selected)item.isActive=active;renderDoorManagerGrid();
}
async function deleteSelectedDoors(){
  const selected=doorEditorState.items.filter(item=>item.selected);if(!selected.length){await showNotice("warning","กรุณาเลือกประตูก่อน");return}
  let confirmed=true;if(window.Swal){const result=await Swal.fire({icon:"warning",title:`ลบ ${selected.length} ประตู?`,text:"ประตูที่ลบจะไม่อยู่ในรายการตั้งค่า แต่ประวัติงานเดิมยังคงอยู่",showCancelButton:true,confirmButtonText:"ลบที่เลือก",cancelButtonText:"ยกเลิก",customClass:swalClasses(),buttonsStyling:false,width:430});confirmed=result.isConfirmed}
  if(!confirmed)return;const remove=new Set(selected.map(item=>item.code));doorEditorState.items=doorEditorState.items.filter(item=>!remove.has(item.code));renderDoorManagerGrid();
}

async function saveDoorSettings({useDoor,requireDoor,doors}){if(adminState.busy)return;adminState.busy=true;try{Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});const w=adminState.data.workflow||{};await api("/api/admin/workflow",{method:"POST",body:{useInboundFirst:Number(w.use_inbound_first)!==0,useDocumentCheck:Number(w.use_document_check)!==0,useReceiving:Number(w.use_receiving)!==0,useInboundSecond:Number(w.use_inbound_second)!==0,useDoor,requireDoor:useDoor&&requireDoor}});await api("/api/admin/doors",{method:"POST",body:{doors}});adminState.data=await api("/api/admin/settings");renderAdminShell();await Swal.fire({icon:"success",title:useDoor?"เปิดใช้ประตูรับสินค้าแล้ว":"ปิดใช้ประตูรับสินค้าแล้ว",text:useDoor?"การตั้งค่านี้มีผลกับหน้ารับสินค้าทันที":"พนักงานไม่ต้องกรอกประตูก่อนเริ่มตรวจรับ",timer:1900,showConfirmButton:false,customClass:swalClasses(),width:390})}catch(error){await showNotice("error",error.message)}finally{adminState.busy=false}}

function renderAdminShifts(){let shifts=adminState.data.shifts||[];if(!shifts.length)shifts=[{shift_name:"กะเช้า",start_minute:480,end_minute:1200,color:"#F7AA12"},{shift_name:"กะกลางคืน",start_minute:1200,end_minute:480,color:"#416FC3"}];$("adminPanel").innerHTML=`<div class="admin-section-head"><div><h3>กะทำงาน</h3><p>กำหนดเวลาให้ครบ 24 ชั่วโมง กะที่สิ้นสุดหลังเที่ยงคืนจะนับตามวันที่เริ่มกะ</p></div><button id="addShiftRow" class="primary">เพิ่มกะ</button></div><form id="shiftsForm"><div id="shiftAdminRows" class="shift-admin-list">${shifts.map(shift=>shiftAdminRow(shift)).join("")}</div><div class="admin-form-actions"><button class="primary" type="submit">บันทึกกะทำงาน</button></div></form>`;$("addShiftRow").addEventListener("click",()=>{$("shiftAdminRows").insertAdjacentHTML("beforeend",shiftAdminRow({shift_name:"",start_minute:0,end_minute:0,color:"#416FC3"}));bindShiftRemove();bindShiftTimeHints();syncShiftRowHints()});bindShiftRemove();bindShiftTimeHints();syncShiftRowHints();$("shiftsForm").addEventListener("submit",event=>{event.preventDefault();const shifts=[...document.querySelectorAll(".shift-admin-row")].map(row=>({name:row.querySelector("[data-shift-name]").value.trim(),startMinute:timeToMinute(row.querySelector("[data-shift-start]").value),endMinute:timeToMinute(row.querySelector("[data-shift-end]").value),color:row.querySelector("[data-shift-color]").value}));adminMutation("/api/admin/shifts",{shifts})})}
function shiftAdminRow(shift){return `<div class="shift-admin-row"><input data-shift-name value="${escapeHtml(shift.shift_name||"")}" placeholder="ชื่อกะ"><label>เริ่ม<input data-shift-start type="time" value="${minuteToTime(shift.start_minute)}"></label><label>สิ้นสุด<input data-shift-end type="time" value="${minuteToTime(shift.end_minute)}"></label><span data-shift-day-note class="shift-day-note"></span><input data-shift-color type="color" value="${escapeHtml(shift.color||"#416FC3")}"><button type="button" data-remove-shift>นำออก</button></div>`}
function syncShiftRowHints(){document.querySelectorAll(".shift-admin-row").forEach(row=>{const start=timeToMinute(row.querySelector("[data-shift-start]")?.value),end=timeToMinute(row.querySelector("[data-shift-end]")?.value),note=row.querySelector("[data-shift-day-note]");if(note)note.textContent=start>=end&&start!==end?"ข้ามไปวันถัดไป · นับวันที่เริ่มกะ":"สิ้นสุดในวันเดียวกัน"})}
function bindShiftTimeHints(){document.querySelectorAll("[data-shift-start],[data-shift-end]").forEach(input=>{input.oninput=syncShiftRowHints;input.onchange=syncShiftRowHints})}
function bindShiftRemove(){document.querySelectorAll("[data-remove-shift]").forEach(button=>button.onclick=()=>button.closest(".shift-admin-row").remove())}
function minuteToTime(value){const minute=Math.max(0,Number(value)||0);return `${String(Math.floor(minute/60)).padStart(2,"0")}:${String(minute%60).padStart(2,"0")}`}
function timeToMinute(value){const [hour,minute]=String(value||"").split(":").map(Number);return hour*60+minute}

function renderAdminAlerts(){
  const stages=[
    ['GATE_TO_DOCUMENT','Gate In → ยื่นเอกสาร','รอผู้ขับยื่นเอกสาร'],
    ['DOCUMENT_REVIEW','ยื่นเอกสาร → ตรวจเอกสารเสร็จ','เวลาที่ Inbound ใช้ตรวจเอกสาร'],
    ['DOCUMENT_CHECKED_TO_RECEIVING_START','ตรวจเอกสารเสร็จ → เริ่มตรวจรับ','เวลารอหลังเอกสารพร้อม'],
    ['DOCUMENT_TO_RECEIVING_START','ยื่นเอกสาร → เริ่มตรวจรับ (Workflow เดิม)','ใช้กับรถที่ไม่ได้เปิดขั้นตอนตรวจเอกสาร'],
    ['RECEIVING_DURATION','ระยะเวลาตรวจรับ','อยู่ระหว่างตรวจรับสินค้า'],
    ['RECEIVING_TO_RETURN','รับสินค้าเสร็จ → รับเอกสารคืน','รอคืนเอกสารให้ผู้ขับ'],
    ['RETURN_TO_GATE_OUT','รับเอกสารคืน → Gate Out','รอรถออกจากพื้นที่'],
    ['TOTAL_IN_SITE','เวลารวมในพื้นที่','ตั้งแต่ Gate In จนถึงเวลาปัจจุบันหรือ Gate Out']
  ],levels=[['NORMAL','ปกติ','#59A63E'],['WATCH','เฝ้าระวัง','#F7AA12'],['WARNING','เตือน','#FB5B82'],['URGENT','ล่าช้า','#D5007F'],['CRITICAL','วิกฤต','#D9304F']],defaults={GATE_TO_DOCUMENT:[0,5,10,20,30],DOCUMENT_REVIEW:[0,5,10,20,30],DOCUMENT_CHECKED_TO_RECEIVING_START:[0,10,20,30,45],DOCUMENT_TO_RECEIVING_START:[0,15,30,45,60],RECEIVING_DURATION:[0,30,45,60,90],RECEIVING_TO_RETURN:[0,5,10,20,30],RETURN_TO_GATE_OUT:[0,10,20,30,45],TOTAL_IN_SITE:[0,60,120,180,240]},existing=new Map((adminState.data.alerts||[]).map(rule=>[`${rule.stage_code}:${rule.level_code}`,rule]));
  $("adminPanel").innerHTML=`<div class="admin-section-head"><div><h3>เวลาแจ้งเตือนแต่ละสถานะ</h3><p>กำหนดเวลาเป็นนาที ระบบใช้สีและเสียงเตือนใน Inbound, งานรับสินค้า และ Dashboard โดยไม่เปลี่ยนเวลาจริงของ Event</p></div></div><div class="sla-legend-r88">${levels.map(([,label,color])=>`<span><i style="background:${color}"></i>${label}</span>`).join("")}</div><form id="alertsForm" class="alerts-admin-form sla-admin-r88">${stages.map(([stage,label,note])=>`<fieldset data-alert-stage="${stage}" class="${stage==="DOCUMENT_REVIEW"?"highlight-stage":""}"><legend><b>${label}</b><small>${note}</small></legend><div class="alert-level-grid">${levels.map(([level,levelLabel,color],index)=>{const rule=existing.get(`${stage}:${level}`),fallback=defaults[stage]?.[index]??index*15;return `<label><span>${levelLabel}</span><input data-alert-level="${level}" type="number" min="0" step="1" value="${Math.round(Number(rule?.start_seconds??fallback*60)/60)}"><small>นาที</small><input data-alert-color type="color" value="${escapeHtml(rule?.color||color)}"><input data-alert-sound type="checkbox" ${rule?.sound_enabled?"checked":""}><small>เสียง</small></label>`}).join("")}</div></fieldset>`).join("")}<div class="admin-form-actions"><button class="primary" type="submit">บันทึกเวลาแจ้งเตือน</button></div></form>`;
  $("alertsForm").addEventListener("submit",event=>{event.preventDefault();const rules=[];document.querySelectorAll("[data-alert-stage]").forEach(field=>field.querySelectorAll("[data-alert-level]").forEach(input=>{const label=input.closest("label");rules.push({stageCode:field.dataset.alertStage,levelCode:input.dataset.alertLevel,startSeconds:Math.round(Number(input.value)*60),color:label.querySelector("[data-alert-color]").value,soundEnabled:label.querySelector("[data-alert-sound]").checked,repeatSeconds:null,isActive:true})}));adminMutation("/api/admin/alerts",{rules})})
}

function rejectionReasonAdminRow(item={}){
  const id=String(item.reason_id||item.reasonId||crypto.randomUUID()),label=String(item.reason_label||item.label||""),active=item.is_active===0||item.isActive===false?false:true,isDefault=Number(item.is_default||0)===1||item.isDefault===true,requireNote=Number(item.require_note||0)===1||item.requireNote===true;
  return `<div class="rejection-admin-row reason-row" data-rejection-reason-row data-id="${escapeHtml(id)}"><input class="rejection-label-input" data-rejection-label maxlength="120" value="${escapeHtml(label)}" placeholder="ชื่อเหตุผล"><label class="rejection-mini-check"><input type="radio" name="rejectionDefaultReason" data-rejection-default ${isDefault?"checked":""}><span>ค่าเริ่มต้น</span></label><label class="rejection-mini-check"><input type="checkbox" data-rejection-note ${requireNote?"checked":""}><span>บังคับรายละเอียด</span></label><label class="rejection-mini-check"><input type="checkbox" data-rejection-active ${active?"checked":""}><span>เปิด</span></label><button type="button" class="quiet-button rejection-remove" data-rejection-remove>ลบ</button></div>`;
}
function rejectionSupervisorAdminRow(item={}){
  const id=String(item.supervisor_id||item.supervisorId||crypto.randomUUID()),name=String(item.supervisor_name||item.name||""),position=String(item.position||""),active=item.is_active===0||item.isActive===false?false:true;
  return `<div class="rejection-admin-row supervisor-row" data-rejection-supervisor-row data-id="${escapeHtml(id)}"><input data-supervisor-name maxlength="120" value="${escapeHtml(name)}" placeholder="ชื่อ-นามสกุล"><input data-supervisor-position maxlength="120" value="${escapeHtml(position)}" placeholder="ตำแหน่ง (ถ้ามี)"><label class="rejection-mini-check"><input type="checkbox" data-supervisor-active ${active?"checked":""}><span>เปิด</span></label><button type="button" class="quiet-button rejection-remove" data-supervisor-remove>ลบ</button></div>`;
}
function bindRejectionAdminRows(){
  document.querySelectorAll("[data-rejection-remove]").forEach(button=>button.onclick=()=>{const row=button.closest("[data-rejection-reason-row]");if(!row)return;if(document.querySelectorAll("[data-rejection-reason-row]").length<=1){showNotice("warning","ต้องมีเหตุผลอย่างน้อย 1 รายการ");return}const wasDefault=row.querySelector("[data-rejection-default]")?.checked;row.remove();if(wasDefault){const first=document.querySelector("[data-rejection-reason-row] [data-rejection-default]");if(first)first.checked=true}});
  document.querySelectorAll("[data-supervisor-remove]").forEach(button=>button.onclick=()=>button.closest("[data-rejection-supervisor-row]")?.remove());
}
function renderAdminRejections(){
  const panel=$("adminPanel");if(!panel)return;const reasons=adminState.data.rejectionReasons||[],supervisors=adminState.data.rejectionSupervisors||[];
  panel.innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>ปฏิเสธการรับสินค้า</h3><p>กำหนดเหตุผลและรายชื่อหัวหน้างานที่ให้เลือกในหน้ารับสินค้า</p></div></div><form id="rejectionSettingsForm" class="rejection-settings-admin"><section class="rejection-admin-card"><header><div><h3>เหตุผลการปฏิเสธ</h3><p>เหตุผลเริ่มต้นใช้ “ตกเวลา” และเปลี่ยนได้ตามหน้างาน</p></div><button id="addRejectionReason" type="button" class="outline-button">เพิ่มเหตุผล</button></header><div class="rejection-reason-head"><span>เหตุผล</span><span>ค่าเริ่มต้น</span><span>รายละเอียด</span><span>สถานะ</span><span></span></div><div id="rejectionReasonRows" class="rejection-admin-rows">${reasons.map(rejectionReasonAdminRow).join("")}</div></section><section class="rejection-admin-card"><header><div><h3>หัวหน้างานที่รับทราบ</h3><p>ต้องเลือก 1 คนก่อนยืนยันการปฏิเสธ</p></div><button id="addRejectionSupervisor" type="button" class="outline-button">เพิ่มชื่อ</button></header><div class="rejection-supervisor-head"><span>ชื่อ-นามสกุล</span><span>ตำแหน่ง</span><span>สถานะ</span><span></span></div><div id="rejectionSupervisorRows" class="rejection-admin-rows">${supervisors.map(rejectionSupervisorAdminRow).join("")}</div></section><div class="admin-form-actions clean-sticky-actions"><button class="primary" type="submit">บันทึกการตั้งค่า</button></div></form>`;
  $("addRejectionReason")?.addEventListener("click",()=>{const box=$("rejectionReasonRows");if(!box)return;box.insertAdjacentHTML("beforeend",rejectionReasonAdminRow({label:"",isActive:true}));bindRejectionAdminRows();box.lastElementChild?.querySelector("[data-rejection-label]")?.focus()});
  $("addRejectionSupervisor")?.addEventListener("click",()=>{const box=$("rejectionSupervisorRows");if(!box)return;box.insertAdjacentHTML("beforeend",rejectionSupervisorAdminRow({name:"",isActive:true}));bindRejectionAdminRows();box.lastElementChild?.querySelector("[data-supervisor-name]")?.focus()});bindRejectionAdminRows();
  $("rejectionSettingsForm")?.addEventListener("submit",async event=>{event.preventDefault();const reasons=[...document.querySelectorAll("[data-rejection-reason-row]")].map((row,index)=>({reasonId:row.dataset.id,label:row.querySelector("[data-rejection-label]")?.value.trim()||"",isDefault:Boolean(row.querySelector("[data-rejection-default]")?.checked),requireNote:Boolean(row.querySelector("[data-rejection-note]")?.checked),isActive:Boolean(row.querySelector("[data-rejection-active]")?.checked),sortOrder:(index+1)*10})),supervisors=[...document.querySelectorAll("[data-rejection-supervisor-row]")].map((row,index)=>({supervisorId:row.dataset.id,name:row.querySelector("[data-supervisor-name]")?.value.trim()||"",position:row.querySelector("[data-supervisor-position]")?.value.trim()||"",isActive:Boolean(row.querySelector("[data-supervisor-active]")?.checked),sortOrder:(index+1)*10}));if(reasons.some(item=>!item.label)){await showNotice("warning","กรุณากรอกชื่อเหตุผลให้ครบ");return}if(!reasons.some(item=>item.isActive&&item.isDefault)){await showNotice("warning","กรุณาเลือกเหตุผลเริ่มต้นที่เปิดใช้งาน 1 รายการ");return}if(supervisors.some(item=>!item.name)){await showNotice("warning","กรุณากรอกชื่อหัวหน้างานให้ครบ");return}await adminMutation("/api/admin/rejections",{reasons,supervisors})});
}

function trackingNumber(value,fallback,min,max){const n=Number(value);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.round(n))):fallback}
function trackingSettingsFromForm(){
  const enabled=Boolean($("trackingMasterSwitch")?.checked);
  const fields=[
    ["trackingFirstSeconds","QR รอบแรก",8,60],
    ["trackingRepeatSeconds","QR เมื่อสแกนซ้ำ",8,60],
    ["trackingMaxHours","อายุการติดตามสูงสุด",1,168],
    ["trackingAfterOutHours","ระยะเวลาหลังรถออกจากพื้นที่",0,48]
  ];
  const values={enabled};
  const keys=["firstDisplaySeconds","repeatDisplaySeconds","maxHours","afterGateOutHours"];
  for(let i=0;i<fields.length;i++){
    const [id,label,min,max]=fields[i],input=$(id),raw=String(input?.value??"").trim(),number=Number(raw);
    if(!raw||!Number.isFinite(number)||!Number.isInteger(number)||number<min||number>max){
      input?.focus();throw new Error(`${label} ต้องเป็นจำนวนเต็มระหว่าง ${min}–${max}`)
    }
    values[keys[i]]=number;
  }
  return values;
}
function trackingSettingsMatch(saved,expected){
  if(!saved)return false;
  const enabled=saved.enabled!==false&&Number(saved.enabled)!==0;
  return enabled===Boolean(expected.enabled)&&trackingNumber(saved.firstDisplaySeconds,15,8,60)===expected.firstDisplaySeconds&&trackingNumber(saved.repeatDisplaySeconds,20,8,60)===expected.repeatDisplaySeconds&&trackingNumber(saved.maxHours,24,1,168)===expected.maxHours&&trackingNumber(saved.afterGateOutHours,2,0,48)===expected.afterGateOutHours;
}
function renderAdminTracking(){
  const panel=$("adminPanel");if(!panel)return;
  const tracking=adminState.data.tracking||{},trackingEnabled=tracking.enabled!==false&&Number(tracking.enabled)!==0;
  const first=trackingNumber(tracking.firstDisplaySeconds,15,8,60),repeat=trackingNumber(tracking.repeatDisplaySeconds,20,8,60),maxHours=trackingNumber(tracking.maxHours,24,1,168),afterOut=trackingNumber(tracking.afterGateOutHours,2,0,48);
  panel.innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>การติดตามสำหรับคนขับ</h3><p>กำหนดการแสดง QR และอายุการติดตามจากหน้านี้</p></div><div class="tracking-saved-pill"><span>ค่าที่ใช้งานอยู่</span><b>${trackingEnabled?"เปิดใช้งาน":"ปิดใช้งาน"}</b></div></div>
  <form id="trackingSettingsForm" class="tracking-settings-form">
    <section class="driver-tracking-master ${trackingEnabled?"is-on":"is-off"}">
      <div><small>การติดตามสถานะสำหรับคนขับ</small><h3 id="trackingMasterTitle">${trackingEnabled?"เปิดใช้งาน":"ปิดใช้งาน"}</h3><p id="trackingMasterText">${trackingEnabled?"หน้า Inbound สามารถแสดง QR ให้คนขับติดตามสถานะรถได้":"หน้า Inbound จะไม่แสดง QR ติดตามสำหรับคนขับ"}</p><strong>การตั้งค่านี้ไม่กระทบกล้องสแกน Auto ID ของเจ้าหน้าที่</strong></div>
      <label class="large-toggle"><input id="trackingMasterSwitch" type="checkbox" ${trackingEnabled?"checked":""}><span></span></label>
    </section>
    <section id="trackingOptions" class="tracking-option-grid ${trackingEnabled?"":"is-muted"}">
      <label class="tracking-number-card"><span><b>QR รอบแรก</b><small>เวลาที่ QR แสดงหลังยื่นเอกสารสำเร็จ</small></span><div><input id="trackingFirstSeconds" type="number" min="8" max="60" step="1" inputmode="numeric" value="${first}"><em>วินาที</em></div></label>
      <label class="tracking-number-card"><span><b>QR เมื่อสแกนซ้ำ</b><small>เวลาที่แสดงอีกครั้งเมื่อสแกนรถคันเดิม</small></span><div><input id="trackingRepeatSeconds" type="number" min="8" max="60" step="1" inputmode="numeric" value="${repeat}"><em>วินาที</em></div></label>
      <label class="tracking-number-card"><span><b>อายุการติดตามสูงสุด</b><small>นับจากช่วงเริ่มงานของรถคันนั้น</small></span><div><input id="trackingMaxHours" type="number" min="1" max="168" step="1" inputmode="numeric" value="${maxHours}"><em>ชั่วโมง</em></div></label>
      <label class="tracking-number-card"><span><b>หลังรถออกจากพื้นที่</b><small>ให้คนขับเปิดดูสถานะย้อนหลังได้อีกช่วงหนึ่ง</small></span><div><input id="trackingAfterOutHours" type="number" min="0" max="48" step="1" inputmode="numeric" value="${afterOut}"><em>ชั่วโมง</em></div></label>
    </section>
    <section class="tracking-current-summary" aria-label="ค่าที่กำลังใช้งาน"><div><small>QR รอบแรก</small><b>${first} วินาที</b></div><div><small>สแกนซ้ำ</small><b>${repeat} วินาที</b></div><div><small>อายุสูงสุด</small><b>${maxHours} ชั่วโมง</b></div><div><small>หลังออก</small><b>${afterOut} ชั่วโมง</b></div></section>
    <div class="tracking-setting-note"><b>การแสดง QR ซ้ำไม่สร้างรายการใหม่ในฐานข้อมูล</b><span>ระบบใช้ข้อมูลรถคันเดิมและรอบ Gate In เดิม การปรับเวลามีผลเฉพาะการแสดงผลและอายุลิงก์</span></div>
    <div class="admin-form-actions"><button id="trackingSaveButton" class="primary" type="submit">บันทึกการติดตามคนขับ</button></div>
  </form>
  <section id="trackingLinkSection" class="driver-track-admin ${trackingEnabled?"":"is-muted"}"><header><div><h3>ลิงก์สำหรับคนขับ</h3><p>ใช้ค้นหาและสร้างลิงก์สำรองสำหรับรถที่กำลังปฏิบัติงาน</p></div></header><div class="driver-track-create"><label><span>Auto ID หรือหมายเลขนัดหมาย</span><input id="trackingSearch" type="text" autocomplete="off" placeholder="ระบุข้อมูลรถ" ${trackingEnabled?"":"disabled"}></label><button id="trackingCreate" class="primary" type="button" ${trackingEnabled?"":"disabled"}>สร้างลิงก์</button></div><div id="trackingResult" class="driver-track-result" hidden></div></section>`;
  const master=$("trackingMasterSwitch"),options=$("trackingOptions"),linkSection=$("trackingLinkSection"),sync=()=>{const on=Boolean(master?.checked);options?.classList.toggle("is-muted",!on);linkSection?.classList.toggle("is-muted",!on);["trackingFirstSeconds","trackingRepeatSeconds","trackingMaxHours","trackingAfterOutHours"].forEach(id=>{const el=$(id);if(el)el.disabled=!on});const search=$("trackingSearch"),create=$("trackingCreate");if(search)search.disabled=!on;if(create)create.disabled=!on;$("trackingMasterTitle").textContent=on?"เปิดใช้งาน":"ปิดใช้งาน";$("trackingMasterText").textContent=on?"หน้า Inbound สามารถแสดง QR ให้คนขับติดตามสถานะรถได้":"หน้า Inbound จะไม่แสดง QR ติดตามสำหรับคนขับ";master?.closest(".driver-tracking-master")?.classList.toggle("is-on",on);master?.closest(".driver-tracking-master")?.classList.toggle("is-off",!on)};master?.addEventListener("change",sync);sync();
  $("trackingSettingsForm")?.addEventListener("submit",async event=>{event.preventDefault();if(adminState.busy)return;let values;try{values=trackingSettingsFromForm()}catch(error){await showNotice("warning",error.message);return}adminState.busy=true;const saveButton=$("trackingSaveButton");if(saveButton)saveButton.disabled=true;try{Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});const result=await api("/api/admin/tracking",{method:"POST",body:values});const refreshed=await api("/api/admin/settings");if(!trackingSettingsMatch(refreshed.tracking,values))throw new Error("ระบบบันทึกแล้วแต่ค่าที่อ่านกลับไม่ตรงกัน กรุณาลองใหม่");adminState.data=refreshed;renderAdminShell();await Swal.fire({icon:"success",title:result.message||"บันทึกการติดตามคนขับแล้ว",text:`QR รอบแรก ${values.firstDisplaySeconds} วินาที • สแกนซ้ำ ${values.repeatDisplaySeconds} วินาที`,timer:2100,showConfirmButton:false,customClass:swalClasses(),width:420})}catch(error){await showNotice("error",error.message||"บันทึกการติดตามคนขับไม่สำเร็จ")}finally{adminState.busy=false;if(saveButton)saveButton.disabled=false}});
  $("trackingCreate")?.addEventListener("click",createDriverTrackingLink);$("trackingSearch")?.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();createDriverTrackingLink()}})
}

const QUEUE_REASON_LABELS={NO_SHOW:"รถยังไม่เข้าจุดตรวจรับ",DRIVER_NOT_FOUND:"ไม่พบคนขับ",WRONG_DOOR:"รถเข้าผิดประตู",DOOR_CHANGE:"เปลี่ยนประตู",GENERAL:"เรียกซ้ำทั่วไป",OTHER:"อื่น ๆ"};
function renderAdminQueueRecall(){
  const panel=$("adminPanel"),q=adminState.data.queueRecall||state.queueRecall||{},enabled=q.enabled!==false&&Number(q.enabled)!==0,reasons=new Set(Array.isArray(q.enabledReasons)?q.enabledReasons:Object.keys(QUEUE_REASON_LABELS));
  panel.innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>การเรียกรถซ้ำ</h3><p>ควบคุมการเรียกรถอีกครั้งโดยไม่เปลี่ยนเวลาเริ่มตรวจรับจริง</p></div><span class="tracking-saved-pill"><span>สถานะ</span><b>${enabled?"เปิดใช้งาน":"ปิดใช้งาน"}</b></span></div>
  <form id="queueRecallSettingsForm" class="queue-recall-admin-form">
    <section class="door-master-switch ${enabled?"is-on":"is-off"}"><div><small>อนุญาตให้เรียกรถซ้ำ</small><h3 id="queueRecallMasterTitle">${enabled?"เปิดใช้งาน":"ปิดใช้งาน"}</h3><p id="queueRecallMasterText">${enabled?"รถที่เรียกแล้วแต่ยังไม่เข้าจุดตรวจรับสามารถเรียกอีกครั้งได้":"รถที่เรียกแล้วจะไม่สามารถกดเรียกซ้ำได้"}</p></div><label class="large-toggle"><input id="queueRecallEnabled" type="checkbox" ${enabled?"checked":""}><span></span></label></section>
    <section id="queueRecallOptions" class="queue-recall-options ${enabled?"":"is-muted"}">
      <div class="queue-recall-number-grid">
        <label><span>เว้นก่อนเรียกซ้ำ</span><div><input id="queueRecallCooldown" type="number" min="3" max="120" value="${Number(q.cooldownSeconds||10)}"><em>วินาที</em></div><small>กันการกดซ้ำติดกันโดยไม่ตั้งใจ</small></label>
        <label><span>จำนวนครั้งสูงสุดต่อรถ</span><div><input id="queueRecallMaxCalls" type="number" min="0" max="20" value="${Number(q.maxCalls||0)}"><em>ครั้ง</em></div><small>0 = ไม่จำกัด รวมการเรียกครั้งแรก</small></label>
      </div>
      <div class="queue-recall-switch-grid">
        <label class="setting-switch-card compact-setting"><span><b>ต้องเลือกเหตุผล</b><small>บังคับให้ระบุสาเหตุทุกครั้งที่เรียกซ้ำ</small></span><input id="queueRecallRequireReason" type="checkbox" ${q.requireReason===false||Number(q.requireReason)===0?"":"checked"}></label>
        <label class="setting-switch-card compact-setting"><span><b>อนุญาตเปลี่ยนประตู</b><small>เปลี่ยนประตูพร้อมเรียกรถใหม่ได้เมื่อหน้างานจำเป็น</small></span><input id="queueRecallAllowDoorChange" type="checkbox" ${q.allowDoorChange===false||Number(q.allowDoorChange)===0?"":"checked"}></label>
        <label class="setting-switch-card compact-setting"><span><b>เหตุผลเปลี่ยนประตูต้องเลือกประตูใหม่</b><small>ป้องกันการเลือก “เปลี่ยนประตู” แต่ยังใช้ประตูเดิม</small></span><input id="queueRecallRequireNewDoor" type="checkbox" ${q.requireNewDoorOnChange===false||Number(q.requireNewDoorOnChange)===0?"":"checked"}></label>
      </div>
      <section class="queue-recall-reasons"><header><h3>เหตุผลที่พนักงานเลือกได้</h3><p>ปิดเหตุผลที่ไม่ใช้ในหน้างานเพื่อลดการเลือกผิด</p></header><div>${Object.entries(QUEUE_REASON_LABELS).map(([code,label])=>`<label><input type="checkbox" data-queue-reason="${code}" ${reasons.has(code)?"checked":""}><span>${label}</span></label>`).join("")}</div></section>
    </section>
    <div class="admin-form-actions clean-sticky-actions"><button class="primary" type="submit">บันทึกการเรียกรถซ้ำ</button></div>
  </form>`;
  const master=$("queueRecallEnabled"),options=$("queueRecallOptions"),title=$("queueRecallMasterTitle"),text=$("queueRecallMasterText"),sync=()=>{const on=master.checked;options.classList.toggle("is-muted",!on);title.textContent=on?"เปิดใช้งาน":"ปิดใช้งาน";text.textContent=on?"รถที่เรียกแล้วแต่ยังไม่เข้าจุดตรวจรับสามารถเรียกอีกครั้งได้":"รถที่เรียกแล้วจะไม่สามารถกดเรียกซ้ำได้";master.closest(".door-master-switch")?.classList.toggle("is-on",on);master.closest(".door-master-switch")?.classList.toggle("is-off",!on)};master.addEventListener("change",sync);sync();
  $("queueRecallSettingsForm").addEventListener("submit",async event=>{event.preventDefault();const enabledReasons=[...document.querySelectorAll("[data-queue-reason]:checked")].map(el=>el.dataset.queueReason);if($("queueRecallRequireReason").checked&&!enabledReasons.length){await showNotice("warning","กรุณาเปิดเหตุผลอย่างน้อย 1 รายการ");return}await adminMutation("/api/admin/queue-recall",{enabled:master.checked,cooldownSeconds:Number($("queueRecallCooldown").value),maxCalls:Number($("queueRecallMaxCalls").value),requireReason:$("queueRecallRequireReason").checked,allowDoorChange:$("queueRecallAllowDoorChange").checked,requireNewDoorOnChange:$("queueRecallRequireNewDoor").checked,enabledReasons})});
}

const ADMIN_VOICE_PROVINCES=["กรุงเทพมหานคร", "กระบี่", "กาญจนบุรี", "กาฬสินธุ์", "กำแพงเพชร", "ขอนแก่น", "จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ชัยนาท", "ชัยภูมิ", "ชุมพร", "เชียงราย", "เชียงใหม่", "ตรัง", "ตราด", "ตาก", "นครนายก", "นครปฐม", "นครพนม", "นครราชสีมา", "นครศรีธรรมราช", "นครสวรรค์", "นนทบุรี", "นราธิวาส", "น่าน", "บึงกาฬ", "บุรีรัมย์", "ปทุมธานี", "ประจวบคีรีขันธ์", "ปราจีนบุรี", "ปัตตานี", "พระนครศรีอยุธยา", "พะเยา", "พังงา", "พัทลุง", "พิจิตร", "พิษณุโลก", "เพชรบุรี", "เพชรบูรณ์", "แพร่", "ภูเก็ต", "มหาสารคาม", "มุกดาหาร", "แม่ฮ่องสอน", "ยโสธร", "ยะลา", "ร้อยเอ็ด", "ระนอง", "ระยอง", "ราชบุรี", "ลพบุรี", "ลำปาง", "ลำพูน", "เลย", "ศรีสะเกษ", "สกลนคร", "สงขลา", "สตูล", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระแก้ว", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "สุราษฎร์ธานี", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อ่างทอง", "อำนาจเจริญ", "อุดรธานี", "อุตรดิตถ์", "อุทัยธานี", "อุบลราชธานี"];
const ADMIN_DEFAULT_PROVINCE_ALIASES=[{alias:"กทม",province:"กรุงเทพมหานคร"},{alias:"กท",province:"กรุงเทพมหานคร"},{alias:"กรุงเทพ",province:"กรุงเทพมหานคร"},{alias:"กรุงเทพฯ",province:"กรุงเทพมหานคร"},{alias:"อยุธยา",province:"พระนครศรีอยุธยา"},{alias:"อย",province:"พระนครศรีอยุธยา"}];
function voiceProvinceOptions(selected=""){return ADMIN_VOICE_PROVINCES.map(name=>`<option value="${escapeHtml(name)}" ${name===selected?"selected":""}>${escapeHtml(name)}</option>`).join("")}
function voiceAliasRow(row={},index=0){const province=ADMIN_VOICE_PROVINCES.includes(String(row.province||""))?String(row.province):"กรุงเทพมหานคร";return `<div class="voice-alias-row" data-alias-row><input data-alias-input type="text" maxlength="40" value="${escapeHtml(row.alias||"")}" placeholder="เช่น กทม"><select data-alias-province>${voiceProvinceOptions(province)}</select><button type="button" class="quiet-button voice-alias-remove" data-alias-remove aria-label="ลบคำย่อนี้">ลบ</button></div>`}
function collectVoiceProvinceAliases(){return[...document.querySelectorAll("[data-alias-row]")].map(row=>({alias:row.querySelector("[data-alias-input]")?.value.trim()||"",province:row.querySelector("[data-alias-province]")?.value||""})).filter(row=>row.alias&&row.province)}
function appendVoiceAliasRow(row={alias:"",province:"กรุงเทพมหานคร"}){const box=$("provinceAliasRows");if(!box)return;box.insertAdjacentHTML("beforeend",voiceAliasRow(row,box.children.length));bindVoiceAliasRemove()}
function bindVoiceAliasRemove(){document.querySelectorAll("[data-alias-remove]").forEach(button=>{button.onclick=()=>button.closest("[data-alias-row]")?.remove()})}
function selectedVoicePack(){const packs=adminState.data.voice?.availablePacks||[];return packs.find(item=>item.id===$("voicePack")?.value)||packs[0]||{}}
function syncVoicePlateControls(){const supported=selectedVoicePack()?.supportsPlateProvince===true,plate=$("voiceReadPlate"),province=$("voiceReadProvince"),aliases=$("provinceAliasCard");if(plate)plate.disabled=!supported;if(province)province.disabled=!supported||!plate?.checked;if(aliases)aliases.classList.toggle("is-muted",!supported||!plate?.checked||!province?.checked);const note=$("voicePlateSupportNote");if(note)note.textContent=supported?"ชุดนี้อ่านทะเบียนรถและจังหวัดได้":"ชุดเสียงนี้ยังไม่รองรับการอ่านทะเบียนรถและจังหวัด"}
function renderAdminVoice(){
  const panel=$("adminPanel");if(!panel)return;
  const fallbackPacks=[{id:"th-TH-standard-01",label:"เสียงไทย ชุดมาตรฐาน 01",supportsPlateProvince:false,assetBasePath:"/voice/queue/th-TH/standard-01/"},{id:"th-TH-female-01",label:"เสียงผู้หญิง ใสหวาน 01",supportsPlateProvince:false,assetBasePath:"/voice/queue/th-TH/female-01/"},{id:"th-TH-female-02",label:"เสียงผู้หญิง ใสหวาน — อ่านทะเบียน",supportsPlateProvince:true,assetBasePath:"/voice/queue/th-TH/female-02/"}];
  const v=adminState.data.voice||{enabled:false,volume:80,repeatCount:1,repeatDelaySeconds:7,playbackRate:1,readDoor:true,readDoorLeadingZero:false,readPlate:true,readProvince:true,playDing:true,playThanks:true,speechPace:"normal",provinceAliases:ADMIN_DEFAULT_PROVINCE_ALIASES,packId:"th-TH-standard-01",availablePacks:fallbackPacks};
  const packs=Array.isArray(v.availablePacks)&&v.availablePacks.length?v.availablePacks:fallbackPacks,aliases=Array.isArray(v.provinceAliases)?v.provinceAliases:ADMIN_DEFAULT_PROVINCE_ALIASES;
  const packOptions=packs.map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===v.packId?"selected":""}>${escapeHtml(item.label)}</option>`).join("");
  panel.innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>เสียงประกาศคิว</h3><p>กำหนดข้อมูลที่อ่าน ลำดับเสียง และคำย่อจังหวัด โดยไม่กระทบเวลาและขั้นตอนงาน</p></div><span class="tracking-saved-pill"><span>เสียงที่ใช้อยู่</span><b>${escapeHtml(v.packLabel||packs.find(x=>x.id===v.packId)?.label||"ชุดมาตรฐาน")}</b></span></div>
  <div id="voiceReadyStatus" class="voice-ready-status"><b>กำลังตรวจสอบชุดเสียง</b><span>รอสักครู่</span></div>
  <form id="voiceSettingsForm" class="admin-form-grid voice-admin-form">
    <label class="admin-toggle-row"><span><b>เปิดเสียงประกาศคิว</b><small>ปิดเสียงได้โดยไม่กระทบการเรียกรถหรือเวลาของงาน</small></span><input id="voiceEnabled" type="checkbox" ${v.enabled?"checked":""}></label>
    <section class="voice-speed-card admin-form-span-2">
      <header><div><b>ความเร็วเสียง</b><small>ปรับความเร็วของไฟล์เสียงจริง โดยยังใช้จังหวะเว้นคำที่เลือกด้านล่าง</small></div><div class="voice-speed-current"><span>ค่าปัจจุบัน</span><strong id="voiceSpeedValue">${Number(v.playbackRate||1).toFixed(2)}x</strong></div></header>
      <div class="voice-speed-control"><input id="voicePlaybackRate" type="range" min="0.90" max="1.35" step="0.05" value="${Number(v.playbackRate||1)}" aria-label="ความเร็วเสียง"><div class="voice-speed-scale"><span>0.90x</span><span>1.00x</span><span>1.15x</span><span>1.30x</span><span>1.35x</span></div></div>
      <div class="voice-speed-actions"><div class="voice-speed-presets"><button type="button" class="outline-button" data-voice-rate="1.00">ปกติ 1.00x</button><button type="button" class="outline-button" data-voice-rate="1.15">เร็ว 1.15x</button><button type="button" class="outline-button" data-voice-rate="1.30">เร็วมาก 1.30x</button></div><button id="voiceSpeedTest" class="outline-button voice-speed-test" type="button">▶ ทดสอบเสียงตามค่าปัจจุบัน</button></div>
    </section>
    <label><span>เลือกเสียงประกาศ</span><select id="voicePack">${packOptions}</select><small id="voicePlateSupportNote" class="field-help"></small></label>
    <label><span>ระดับเสียง (%)</span><input id="voiceVolume" type="number" min="10" max="100" value="${Number(v.volume||80)}"></label>
    <label><span>จังหวะการอ่าน</span><select id="voiceSpeechPace"><option value="compact" ${v.speechPace==="compact"?"selected":""}>กระชับ</option><option value="normal" ${!v.speechPace||v.speechPace==="normal"?"selected":""}>ปกติ</option><option value="clear" ${v.speechPace==="clear"?"selected":""}>ชัดเจน</option></select></label>
    <label><span>จำนวนครั้งที่ประกาศ</span><input id="voiceRepeatCount" type="number" min="1" max="3" value="${Number(v.repeatCount||1)}"></label>
    <label><span>เว้นก่อนทวนซ้ำ (วินาที)</span><input id="voiceRepeatDelay" type="number" min="3" max="30" value="${Number(v.repeatDelaySeconds||7)}"></label>
    <section class="voice-read-card admin-form-span-2"><header><div><b>ข้อมูลที่อ่าน</b><small>ลำดับหลัก: หมายเลขนัดหมาย → ทะเบียนรถ → จังหวัด → คำสั่ง → ประตู</small></div></header><div class="voice-read-grid">
      <label class="admin-toggle-row"><span><b>อ่านทะเบียนรถ</b><small>อ่านตัวเลขและพยัญชนะไทยตามทะเบียน</small></span><input id="voiceReadPlate" type="checkbox" ${v.readPlate!==false?"checked":""}></label>
      <label class="admin-toggle-row"><span><b>อ่านจังหวัด</b><small>อ่านต่อจากทะเบียน เมื่อระบบรู้จักชื่อจังหวัด</small></span><input id="voiceReadProvince" type="checkbox" ${v.readProvince!==false?"checked":""}></label>
      <label class="admin-toggle-row"><span><b>อ่านหมายเลขประตู</b><small>อ่านเฉพาะเมื่อรายการใช้ประตู</small></span><input id="voiceReadDoor" type="checkbox" ${v.readDoor!==false?"checked":""}></label>
      <label class="admin-toggle-row"><span><b>อ่านเลขศูนย์หน้าประตู</b><small>เช่น R07 อ่าน อาร์ ศูนย์ เจ็ด</small></span><input id="voiceDoorZero" type="checkbox" ${v.readDoorLeadingZero?"checked":""}></label>
      <label class="admin-toggle-row"><span><b>เสียงเตือนก่อนประกาศ</b><small>เล่นเสียงสั้นก่อนเริ่มอ่าน</small></span><input id="voicePlayDing" type="checkbox" ${v.playDing!==false?"checked":""}></label>
      <label class="admin-toggle-row"><span><b>กล่าวขอบคุณท้ายประกาศ</b><small>กล่าวขอบคุณหลังคำสั่งเสร็จ</small></span><input id="voicePlayThanks" type="checkbox" ${v.playThanks!==false?"checked":""}></label>
    </div></section>
    <section id="provinceAliasCard" class="voice-alias-card admin-form-span-2"><header><div><b>คำย่อจังหวัด</b><small>กำหนดให้ระบบรู้ว่าข้อมูลย่อหรือชื่อที่ใช้หน้างานหมายถึงจังหวัดใด เช่น กทม → กรุงเทพมหานคร, อยุธยา → พระนครศรีอยุธยา</small></div><button id="addProvinceAlias" class="outline-button" type="button">เพิ่มคำย่อ</button></header><div class="voice-alias-head"><span>ข้อมูลที่อาจพบ</span><span>ให้อ่านเป็นจังหวัด</span><span></span></div><div id="provinceAliasRows" class="voice-alias-rows">${aliases.map(voiceAliasRow).join("")}</div></section>
    <section class="voice-test-card admin-form-span-2"><header><div><b>ทดลองประกาศ</b><small>ใช้ข้อมูลตัวอย่างเพื่อฟังลำดับเสียงก่อนบันทึก</small></div></header><div class="voice-test-inputs"><label><span>เลขนัดหมาย</span><input id="voiceTestAppointment" value="2006988"></label><label><span>ทะเบียนรถ</span><input id="voiceTestPlate" value="3ฒส3718"></label><label><span>จังหวัด</span><input id="voiceTestProvince" value="กทม"></label><label><span>ประตู</span><input id="voiceTestDoor" value="R07"></label></div><div class="voice-test-actions"><button id="voiceTestFirst" class="outline-button" type="button">ทดลองเรียกรถ</button><button id="voiceTestRecall" class="outline-button" type="button">ทดลองเรียกซ้ำ</button><button id="voiceTestChangeDoor" class="outline-button" type="button">ทดลองเปลี่ยนประตู</button><button id="voiceTestNoDoor" class="outline-button" type="button">ทดลองไม่มีประตู</button></div></section>
    <div class="admin-form-actions admin-form-span-2"><button id="voiceSaveButton" class="primary" type="submit">บันทึกการตั้งค่าเสียง</button></div>
  </form>
  <section class="admin-queue-guide"><article><b>เรียกรถครั้งแรก</b><p>หมายเลขนัดหมาย → ทะเบียน → จังหวัด → คำสั่ง → ประตู</p></article><article><b>เรียกซ้ำ</b><p>ขึ้นต้นด้วย “ขอเรียกซ้ำ” ส่วนการทวนรอบที่สองใช้ “ขอทวนอีกครั้ง” และไม่นับเป็นการเรียกรถเพิ่ม</p></article><article><b>เปลี่ยนประตู</b><p>อ่านประตูใหม่เท่านั้น ประตูเดิมยังเก็บอยู่ในประวัติการเรียกรถ</p></article></section>`;
  bindVoiceAliasRemove();$("addProvinceAlias")?.addEventListener("click",()=>appendVoiceAliasRow());
  $("voiceReadPlate")?.addEventListener("change",syncVoicePlateControls);$("voiceReadProvince")?.addEventListener("change",syncVoicePlateControls);
  $("voiceSettingsForm")?.addEventListener("submit",async e=>{e.preventDefault();if(adminState.busy)return;const body={enabled:$("voiceEnabled").checked,packId:$("voicePack").value,volume:Number($("voiceVolume").value),repeatCount:Number($("voiceRepeatCount").value),repeatDelaySeconds:Number($("voiceRepeatDelay").value),playbackRate:Number($("voicePlaybackRate").value),speechPace:$("voiceSpeechPace").value,playDing:$("voicePlayDing").checked,readDoor:$("voiceReadDoor").checked,readDoorLeadingZero:$("voiceDoorZero").checked,readPlate:$("voiceReadPlate").checked,readProvince:$("voiceReadProvince").checked,playThanks:$("voicePlayThanks").checked,provinceAliases:collectVoiceProvinceAliases()};adminState.busy=true;try{const r=await api("/api/admin/voice",{method:"POST",body});adminState.data=await api("/api/admin/settings");renderAdminShell();await showNotice("success",r.message||"บันทึกการตั้งค่าเสียงแล้ว")}catch(error){await showNotice("error",error.message||"บันทึกการตั้งค่าเสียงไม่สำเร็จ")}finally{adminState.busy=false}});
  const testSettings=()=>{const selected=selectedVoicePack();return{enabled:true,packId:selected.id,assetBasePath:selected.assetBasePath||voicePackAssetPath(selected.id),volume:Number($("voiceVolume").value),repeatCount:1,repeatDelaySeconds:Number($("voiceRepeatDelay").value),playbackRate:Number($("voicePlaybackRate").value),speechPace:$("voiceSpeechPace").value,playDing:$("voicePlayDing").checked,readDoor:$("voiceReadDoor").checked,readDoorLeadingZero:$("voiceDoorZero").checked,readPlate:$("voiceReadPlate").checked,readProvince:$("voiceReadProvince").checked,playThanks:$("voicePlayThanks").checked,provinceAliases:collectVoiceProvinceAliases()}};
  const syncVoiceSpeed=()=>{const input=$("voicePlaybackRate"),value=$("voiceSpeedValue");if(!input||!value)return;const rate=Number(input.value)||1;value.textContent=`${rate.toFixed(2)}x`;document.querySelectorAll("[data-voice-rate]").forEach(button=>button.classList.toggle("is-active",Math.abs(Number(button.dataset.voiceRate)-rate)<.001))};
  $("voicePlaybackRate")?.addEventListener("input",syncVoiceSpeed);
  document.querySelectorAll("[data-voice-rate]").forEach(button=>button.addEventListener("click",()=>{if(!$("voicePlaybackRate"))return;$("voicePlaybackRate").value=button.dataset.voiceRate;syncVoiceSpeed()}));syncVoiceSpeed();
  const testItem=(type,useDoor=true,door=null)=>({appointmentNo:$("voiceTestAppointment").value.trim(),vehiclePlate:$("voiceTestPlate").value.trim(),province:$("voiceTestProvince").value.trim(),doorCode:door??$("voiceTestDoor").value.trim(),useDoor,callType:type});
  $("voiceSpeedTest")?.addEventListener("click",()=>testAdminQueueVoice(testSettings(),testItem("FIRST",true),"voiceSpeedTest"));
  $("voiceTestFirst")?.addEventListener("click",()=>testAdminQueueVoice(testSettings(),testItem("FIRST",true),"voiceTestFirst"));
  $("voiceTestRecall")?.addEventListener("click",()=>testAdminQueueVoice(testSettings(),testItem("RECALL",true),"voiceTestRecall"));
  $("voiceTestChangeDoor")?.addEventListener("click",()=>testAdminQueueVoice(testSettings(),testItem("DOOR_CHANGED",true,"S12"),"voiceTestChangeDoor"));
  $("voiceTestNoDoor")?.addEventListener("click",()=>testAdminQueueVoice(testSettings(),testItem("FIRST",false,null),"voiceTestNoDoor"));
  $("voicePack")?.addEventListener("change",()=>{syncVoicePlateControls();updateAdminVoiceReadyStatus()});syncVoicePlateControls();updateAdminVoiceReadyStatus();
}
function voicePackAssetPath(packId){return packId==="th-TH-female-02"?"/voice/queue/th-TH/female-02/":packId==="th-TH-female-01"?"/voice/queue/th-TH/female-01/":"/voice/queue/th-TH/standard-01/"}
async function updateAdminVoiceReadyStatus(){const box=$("voiceReadyStatus");if(!box)return;const packId=$("voicePack")?.value||adminState.data.voice?.packId||"th-TH-standard-01";try{const base=String(cfg.apiBaseUrl||"").replace(/\/$/,""),response=await fetch(base+"/api/voice/status?packId="+encodeURIComponent(packId),{cache:"no-store"}),data=await response.json();if(!response.ok||!data.ready)throw new Error(data.message||"ยังไม่พร้อม");box.classList.add("ready");const c=data.components||{};box.innerHTML=data.supportsPlateProvince?`<b>${escapeHtml(data.packLabel||"ชุดเสียง")} พร้อมใช้งาน</b><span>ตัวเลข ${Number(c.digits||0)}/10 · พยัญชนะ ${Number(c.thaiLetters||0)}/44 · จังหวัด ${Number(c.provinces||0)}/77 · R/S ${Number(c.doorLetters||0)}/2</span>`:`<b>${escapeHtml(data.packLabel||"ชุดเสียง")} พร้อมใช้งาน</b><span>ชุดนี้ใช้การประกาศแบบเดิม ไม่อ่านทะเบียนและจังหวัด</span>`}catch(error){box.classList.remove("ready");box.innerHTML=`<b>ชุดเสียงนี้ยังไม่พร้อม</b><span>${escapeHtml(error.message||"กรุณาตรวจสอบชุดเสียง")}</span>`}}
async function ensureQueueVoiceEngine(){if(window.SmartQueueVoice)return window.SmartQueueVoice;await new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-queue-voice-engine]');if(existing){existing.addEventListener("load",resolve,{once:true});existing.addEventListener("error",reject,{once:true});return}const script=document.createElement("script");script.src="./voice-engine.js?v=20260811-r86";script.dataset.queueVoiceEngine="1";script.onload=resolve;script.onerror=()=>reject(new Error("โหลดระบบเสียงไม่สำเร็จ"));document.head.appendChild(script)});if(!window.SmartQueueVoice)throw new Error("ระบบเสียงยังไม่พร้อม");return window.SmartQueueVoice}
async function testAdminQueueVoice(settings,item={appointmentNo:"2006988",vehiclePlate:"3ฒส3718",province:"กทม",doorCode:"R07",useDoor:true,callType:"FIRST"},buttonId="voiceTestFirst"){const button=$(buttonId),original=button?.textContent||"ทดลองเสียง";if(button){button.disabled=true;button.textContent="กำลังเตรียมเสียง"}try{const engine=await ensureQueueVoiceEngine();engine.configure({...settings,enabled:true,apiBaseUrl:cfg.apiBaseUrl,repeatCount:1});await engine.unlockAndPrepare();await engine.announceNow(item);await showNotice("success","ทดลองประกาศแล้ว")}catch(error){await showNotice("error",error.message||"ทดลองเสียงไม่สำเร็จ")}finally{if(button){button.disabled=false;button.textContent=original}}}

function renderAdminQueue(){
  const panel=$("adminPanel");if(!panel)return;
  const queueUrl=new URL("./queue.html?v=20260811-r88",location.href).href;
  const queueDisplay=adminState.data?.queueDisplay||{showDoorPanel:true};
  const showDoorPanel=queueDisplay.showDoorPanel!==false;
  panel.innerHTML=`<div class="admin-section-head clean-admin-head"><div><h3>จอแสดงสถานะคิว</h3><p>ใช้สำหรับจอส่วนกลาง ต้องเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบหรือผู้ใช้งาน</p></div><a class="primary admin-queue-open" href="./queue.html?v=20260811-r88" target="_blank" rel="noopener">เปิดจอคิว</a></div>
  <section class="admin-form-card admin-queue-display-card"><header><div><b>การแสดงสถานะประตู</b><small>เลือกว่าจะให้จอคิวแสดงรายการประตูด้านขวาหรือไม่</small></div></header><label class="admin-toggle-row"><span><b>แสดงสถานะประตูในจอคิว</b><small>ปิดได้เมื่อต้องการพื้นที่แสดงคิวมากขึ้น โดยไม่กระทบการใช้ประตูของงาน</small></span><input id="queueDoorPanelEnabled" type="checkbox" ${showDoorPanel?"checked":""}></label><div class="admin-form-actions"><button id="queueDisplaySaveButton" class="primary" type="button">บันทึก</button></div></section>
  <section class="admin-queue-guide"><article><b>เรียกรถแยกจากเริ่มตรวจรับ</b><p>พนักงานกด “เรียกรถ” ก่อน เมื่อรถเข้าจุดตรวจรับจริงจึงกด “เริ่มตรวจรับ” เพื่อให้เวลาทำงานตรงกับเหตุการณ์จริง</p></article><article><b>เรียกซ้ำและเปลี่ยนประตู</b><p>รถที่ยังไม่เข้าจุดตรวจรับสามารถเรียกซ้ำได้ และเมื่อเปิดใช้ประตูสามารถเปลี่ยนประตูพร้อมเรียกใหม่โดยเก็บประวัติเดิมไว้</p></article><article><b>กรณีปิดประตู</b><p>เมื่อผู้ดูแลปิดการใช้ประตู ระบบจะไม่บังคับ ไม่แสดง และไม่อ่านหมายเลขประตูในการเรียกรถ</p></article></section>
  <div class="admin-queue-url"><small>ลิงก์จอส่วนกลาง</small><code>${escapeHtml(queueUrl)}</code></div>`;
  $("queueDisplaySaveButton")?.addEventListener("click",async()=>{
    if(adminState.busy)return;
    const button=$("queueDisplaySaveButton"),showDoorPanel=$("queueDoorPanelEnabled")?.checked!==false;
    adminState.busy=true;if(button){button.disabled=true;button.textContent="กำลังบันทึก"}
    try{
      const result=await api("/api/admin/queue-display",{method:"POST",body:{showDoorPanel}});
      adminState.data=await api("/api/admin/settings");
      renderAdminShell();
      await showNotice("success",result.message||"บันทึกการแสดงสถานะประตูแล้ว");
    }catch(error){
      await showNotice("error",error.message||"บันทึกไม่สำเร็จ กรุณาลองใหม่");
    }finally{adminState.busy=false}
  });
}


function adminHealthTone(status){return status==="FAIL"?"fail":status==="WARN"?"warn":"pass"}
function updateAdminHealthBadge(){const badge=$("adminHealthBadge"),label=$("adminHealthBadgeLabel"),time=$("adminHealthBadgeTime"),data=adminHealthState.data;if(!badge)return;badge.classList.remove("health-pass","health-warn","health-fail","health-unknown");const status=data?.status||"UNKNOWN";badge.classList.add(`health-${status.toLowerCase()}`);if(label)label.textContent=status==="PASS"?"พร้อมใช้งาน":status==="WARN"?"ควรตรวจสอบ":status==="FAIL"?"มีปัญหา":adminHealthState.error?"ตรวจไม่สำเร็จ":"กำลังตรวจ";if(time)time.textContent=data?`ตรวจ ${formatDate(data.generatedAt)}`:adminHealthState.error?adminHealthState.error:"กำลังตรวจสอบ"}
async function ensureAdminHealth(force=false){if(adminHealthState.busy)return adminHealthState.data;if(adminHealthState.data&&!force){updateAdminHealthBadge();return adminHealthState.data}adminHealthState.busy=true;adminHealthState.error="";try{adminHealthState.data=await api("/api/admin/diagnostics",{timeoutMs:15000});return adminHealthState.data}catch(error){adminHealthState.error=error.message||"ตรวจระบบไม่สำเร็จ";recordClientIssue("DIAGNOSTIC",adminHealthState.error,"/api/admin/diagnostics");return null}finally{adminHealthState.busy=false;updateAdminHealthBadge()}}
function diagnosticClientHtml(){const c=clientHealthSnapshot(),issue=c.latestIssue;return `<section class="system-health-client"><header><div><b>เครื่องที่กำลังใช้งาน</b><small>ตรวจเฉพาะ Browser เครื่องนี้</small></div><span class="health-mini ${c.online&&c.serviceWorkerControlled?"pass":"warn"}">${c.online?"ออนไลน์":"ออฟไลน์"}</span></header><div class="system-health-client-grid"><span><small>หน้าเว็บ</small><b>${escapeHtml(c.frontendBuild)}</b></span><span><small>Service Worker</small><b>${c.serviceWorkerSupported?(c.serviceWorkerControlled?"ทำงาน":"ยังไม่ควบคุมหน้า"):"ไม่รองรับ"}</b></span><span><small>ปัญหา 24 ชม.</small><b>${c.issues24h}</b></span></div>${issue?`<div class="system-health-latest"><small>ล่าสุด ${escapeHtml(new Date(Number(issue.at||0)).toLocaleString("th-TH"))}</small><span>${escapeHtml(issue.message)}</span></div>`:""}</section>`}
function performanceStatusText(status){return status==="PASS"?"ผ่าน":status==="WARN"?"ตรวจดู":"ต้องแก้"}
async function clientPerformanceProbe(){
  const base=String(cfg.apiBaseUrl||"").replace(/\/$/,""),samples=[];
  for(let i=0;i<3;i++){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000),started=performance.now();
    try{const response=await fetch(`${base}/api/health?_probe=${Date.now()}-${i}`,{method:"GET",cache:"no-store",signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);await response.json().catch(()=>null);samples.push({ok:true,ms:Math.round(performance.now()-started)})}
    catch(error){samples.push({ok:false,ms:Math.round(performance.now()-started),error:error?.name==="AbortError"?"หมดเวลา":String(error?.message||error)})}
    finally{clearTimeout(timer)}
  }
  const good=samples.filter(item=>item.ok),avgMs=good.length?Math.round(good.reduce((sum,item)=>sum+item.ms,0)/good.length):0,maxMs=good.length?Math.max(...good.map(item=>item.ms)):0,status=good.length<samples.length?"FAIL":maxMs>2000?"WARN":"PASS";
  return{status,samples,avgMs,maxMs,success:good.length===samples.length}
}
async function runAdminPerformanceDiagnostics(){
  if(adminPerformanceState.busy)return;adminPerformanceState.busy=true;adminPerformanceState.error="";
  const button=$("healthPerformance");if(button){button.disabled=true;button.textContent="กำลังทดสอบ"}
  try{const [server,client]=await Promise.all([api("/api/admin/diagnostics/performance",{timeoutMs:20000,retries:0}),clientPerformanceProbe()]);adminPerformanceState.data=server;adminPerformanceState.client=client;renderAdminDiagnosticsContent(adminHealthState.data)}
  catch(error){adminPerformanceState.error=error.message||"ทดสอบไม่สำเร็จ";recordClientIssue("PERFORMANCE",adminPerformanceState.error,"/api/admin/diagnostics/performance");await showNotice("error",adminPerformanceState.error)}
  finally{adminPerformanceState.busy=false;if(button){button.disabled=false;button.textContent="ทดสอบความเร็ว"}}
}

async function clientConcurrencyProbe(){
  const base=String(cfg.apiBaseUrl||"").replace(/\/$/,""),token=String(state.token||""),jobs=[];
  const one=async(path,auth=false)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000),started=performance.now();try{const headers={accept:"application/json"};if(auth&&token)headers.authorization=`Bearer ${token}`;const response=await fetch(`${base}${path}${path.includes("?")?"&":"?"}_c=${Date.now()}-${Math.random()}`,{method:"GET",cache:"no-store",headers,signal:controller.signal});if(!response.ok)throw new Error(`HTTP ${response.status}`);await response.json().catch(()=>null);return{ok:true,ms:Math.round(performance.now()-started),path}}catch(error){return{ok:false,ms:Math.round(performance.now()-started),path,error:error?.name==="AbortError"?"หมดเวลา":String(error?.message||error)}}finally{clearTimeout(timer)}};
  for(let i=0;i<6;i++)jobs.push(one("/api/health",false));for(let i=0;i<4;i++)jobs.push(one("/api/auth/me",true));
  const started=performance.now(),samples=await Promise.all(jobs),totalMs=Math.round(performance.now()-started),good=samples.filter(x=>x.ok),maxMs=good.length?Math.max(...good.map(x=>x.ms)):0,avgMs=good.length?Math.round(good.reduce((a,b)=>a+b.ms,0)/good.length):0,status=good.length!==samples.length?"FAIL":maxMs>2500?"WARN":"PASS";
  return{status,samples,totalMs,avgMs,maxMs,successCount:good.length,total:samples.length};
}
async function runAdminResilienceDiagnostics(){
  if(adminResilienceState.busy)return;adminResilienceState.busy=true;adminResilienceState.error="";const button=$("healthResilience");if(button){button.disabled=true;button.textContent="กำลังทดสอบ"}
  try{const [server,client]=await Promise.all([api("/api/admin/diagnostics/resilience",{timeoutMs:20000,retries:0}),clientConcurrencyProbe()]);adminResilienceState.data=server;adminResilienceState.client=client;renderAdminDiagnosticsContent(adminHealthState.data)}
  catch(error){adminResilienceState.error=error.message||"ทดสอบความทนทานไม่สำเร็จ";recordClientIssue("RESILIENCE",adminResilienceState.error,"/api/admin/diagnostics/resilience");await showNotice("error",adminResilienceState.error)}
  finally{adminResilienceState.busy=false;if(button){button.disabled=false;button.textContent="ทดสอบความทนทาน"}}
}
function resilienceDiagnosticsHtml(data,client){
  if(!data)return"";const checks=Array.isArray(data.checks)?data.checks:[],clientTone=adminHealthTone(client?.status||"WARN");return `<section class="system-resilience"><header><div><b>ความทนทานเมื่อมีคำขอพร้อมกัน</b><small>ทดสอบด้วยการอ่านข้อมูลและตรวจตัวป้องกันคำสั่งซ้ำ ไม่สร้างหรือแก้รถ</small></div><span class="health-mini ${adminHealthTone(data.status)}">${escapeHtml(data.statusLabel||"-")}</span></header><div class="system-resilience-summary"><span><small>ฝั่งฐานข้อมูล</small><b>${Number(data.parallel?.requests||0)-Number(data.parallel?.failed||0)}/${Number(data.parallel?.requests||0)}</b><em>${Number(data.parallel?.totalMs||0)} ms</em></span><span><small>เครื่องนี้พร้อมกัน</small><b>${client?`${client.successCount}/${client.total}`:"-"}</b><em class="${clientTone}">${client?`${client.avgMs} ms เฉลี่ย`:"-"}</em></span><span><small>สูงสุดเครื่องนี้</small><b>${client?`${client.maxMs} ms`:"-"}</b><em>${client?performanceStatusText(client.status):"-"}</em></span></div><div class="system-resilience-grid">${checks.map(item=>`<article class="${adminHealthTone(item.status)}"><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail||"")}</small></div><strong>${performanceStatusText(item.status)}</strong></article>`).join("")}</div></section>`
}
function syncWatchdogSettingsHtml(watchdog){
  const settings=watchdog?.settings||{},enabled=watchdog?.enabled!==false,warn=Math.max(1,Math.round(Number(settings.warnAfterSeconds||300)/60)),fail=Math.max(warn+1,Math.round(Number(settings.failAfterSeconds||900)/60)),stale=Math.max(5,Math.round(Number(settings.staleRunningSeconds||900)/60));return `<section class="sync-watchdog ${adminHealthTone(watchdog?.status||"WARN")}"><header><div><b>เฝ้าดูการรับข้อมูล Gate</b><small>แจ้งเมื่อ Worker ไม่ได้รับรอบ Sync ตามเวลาที่กำหนด</small></div><span class="health-mini ${adminHealthTone(watchdog?.status||"WARN")}">${escapeHtml(watchdog?.statusLabel||"-")}</span></header><div class="sync-watchdog-current"><span><small>รอบสำเร็จล่าสุด</small><b>${escapeHtml(watchdog?.ageLabel||"-")}</b></span><span><small>สถานะ</small><b>${escapeHtml(watchdog?.message||"ยังไม่มีข้อมูล")}</b></span></div><div class="sync-watchdog-form"><label class="switch-row"><input id="syncWatchdogEnabled" type="checkbox" ${enabled?"checked":""}><span>เปิดการเฝ้าดู</span></label><label><span>เริ่มเตือนเมื่อเกิน</span><div><input id="syncWatchdogWarn" type="number" min="1" max="60" value="${warn}"><em>นาที</em></div></label><label><span>ถือว่ามีปัญหาเมื่อเกิน</span><div><input id="syncWatchdogFail" type="number" min="2" max="120" value="${fail}"><em>นาที</em></div></label><label><span>RUNNING ค้างเกิน</span><div><input id="syncWatchdogStale" type="number" min="5" max="120" value="${stale}"><em>นาที</em></div></label><button id="syncWatchdogSave" class="quiet-button" type="button">บันทึก</button></div></section>`
}
async function saveSyncWatchdogSettings(){
  const enabled=Boolean($("syncWatchdogEnabled")?.checked),warn=Math.max(1,Number($("syncWatchdogWarn")?.value)||5),fail=Math.max(warn+1,Number($("syncWatchdogFail")?.value)||15),stale=Math.max(5,Number($("syncWatchdogStale")?.value)||15),button=$("syncWatchdogSave");if(button){button.disabled=true;button.textContent="กำลังบันทึก"}
  try{await api("/api/admin/diagnostics/watchdog-settings",{method:"POST",body:{enabled,warnAfterSeconds:Math.round(warn*60),failAfterSeconds:Math.round(fail*60),staleRunningSeconds:Math.round(stale*60)}});adminHealthState.data=null;await renderAdminDiagnostics(true);await showNotice("success","บันทึกเวลาเฝ้าดู Gate แล้ว")}
  catch(error){await showNotice("error",error.message||"บันทึกไม่สำเร็จ")}finally{if(button){button.disabled=false;button.textContent="บันทึก"}}
}

function performanceDiagnosticsHtml(data,client){
  if(!data)return"";const probes=Array.isArray(data.probes)?data.probes:[],plans=Array.isArray(data.plans)?data.plans:[],missing=Array.isArray(data.summary?.missingOptimizations)?data.summary.missingOptimizations:[],clientTone=adminHealthTone(client?.status||"WARN");
  return `<section class="system-performance"><header><div><b>ประสิทธิภาพและความทนทาน</b><small>ทดสอบแบบอ่านข้อมูลเท่านั้น ไม่สร้างงานจำลองและไม่เปลี่ยนสถานะรถ</small></div><span class="health-mini ${adminHealthTone(data.status)}">${escapeHtml(data.statusLabel||"-")}</span></header><div class="system-performance-summary"><span><small>Query เฉลี่ย</small><b>${Number(data.summary?.avgQueryMs||0).toLocaleString("th-TH")} ms</b></span><span><small>Query สูงสุด</small><b>${Number(data.summary?.maxQueryMs||0).toLocaleString("th-TH")} ms</b></span><span><small>เครือข่ายเครื่องนี้</small><b>${client?`${Number(client.avgMs||0)} ms`:"-"}</b><em class="${clientTone}">${client?performanceStatusText(client.status):"-"}</em></span><span><small>Sync ล่าสุดที่ตรวจ</small><b>${Number(data.sync?.sample||0)} รอบ</b><em>${Number(data.sync?.failed||0)} ผิดพลาด</em></span></div><div class="system-performance-grid">${probes.map(item=>`<article class="${adminHealthTone(item.status)}"><div><b>${escapeHtml(item.label)}</b><small>${item.ok===false?escapeHtml(item.error||"ทดสอบไม่ผ่าน"):`${Number(item.wallMs||0)} ms · อ่าน ${Number(item.rowsRead||0).toLocaleString("th-TH")} แถว`}</small></div><strong>${performanceStatusText(item.status)}</strong></article>`).join("")}</div><div class="system-performance-plans"><b>ตัวช่วยค้นหาที่ใช้กับงานหลัก</b>${plans.map(item=>`<span class="${adminHealthTone(item.status)}"><i></i><strong>${escapeHtml(item.label)}</strong><small>${item.usesExpected?`ใช้ ${escapeHtml(item.expectedIndex||"")}`:`ควรมี ${escapeHtml(item.expectedIndex||"ตัวช่วยค้นหา")}`}</small></span>`).join("")}</div>${missing.length?`<div class="system-performance-warning"><b>มีจุดที่ปรับความเร็วได้ ${missing.length} รายการ</b><span>${missing.map(escapeHtml).join(" · ")} · ให้รัน SQL ของ Round 163 ก่อนใช้งานจริง</span></div>`:""}</section>`
}
function productionReadinessHtml(data){
  if(!data)return"";const summary=data.summary||{},buildMatch=String(data.build||"")===String(FRONTEND_BUILD||""),ready=Boolean(data.releaseReady&&buildMatch),tone=ready?"pass":data.status==="FAIL"?"fail":"warn",manual=Array.isArray(data.manual)?data.manual:[],automated=Array.isArray(data.automated)?data.automated:[];
  return `<section class="production-readiness ${tone}"><header><div><b>ความพร้อมก่อนใช้งานจริง</b><small>ผลตรวจอัตโนมัติ + รายการ UAT ที่ต้องยืนยันจากการทดสอบจริง</small></div><span class="health-mini ${tone}">${ready?"พร้อมใช้งานจริง":"ยังไม่พร้อม"}</span></header><div class="production-readiness-summary"><span><small>ตรวจอัตโนมัติ</small><b>${Number(summary.autoPassed||0)}/${Number(summary.autoTotal||0)}</b></span><span><small>UAT ที่ยืนยันแล้ว</small><b>${Number(summary.manualPassed||0)}/${Number(summary.manualTotal||0)}</b></span><span><small>รุ่นหน้าเว็บ / Worker</small><b>${buildMatch?"ตรงกัน":"ไม่ตรงกัน"}</b><em>${escapeHtml(FRONTEND_BUILD)}</em></span></div>${data.uat?.staleBuild?`<div class="production-readiness-warning"><b>รายการ UAT เดิมเป็นคนละรุ่น</b><span>${escapeHtml(data.uat.previousBuild||"")} · ต้องทดสอบใหม่สำหรับรุ่นนี้</span></div>`:""}<div class="production-auto-grid">${automated.map(item=>`<article class="${adminHealthTone(item.status)}"><i></i><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.detail||"")}</small></div><strong>${item.status==="PASS"?"ผ่าน":item.status==="WARN"?"ตรวจดู":"ต้องแก้"}</strong></article>`).join("")}<article class="${buildMatch?"pass":"fail"}"><i></i><div><b>รุ่นหน้าเว็บตรงกับ Worker</b><small>${buildMatch?"ใช้รุ่นเดียวกัน":"หน้าเว็บและ Worker เป็นคนละรุ่น กรุณา Deploy ให้ครบ"}</small></div><strong>${buildMatch?"ผ่าน":"ต้องแก้"}</strong></article></div><div class="production-uat-head"><div><b>รายการทดสอบจริง</b><small>กดผ่านเฉพาะหัวข้อที่ได้ทดสอบหน้างานจริงแล้ว</small></div><button id="productionUatReset" class="quiet-button" type="button">เริ่ม UAT ใหม่</button></div><div class="production-uat-grid">${manual.map(item=>`<button type="button" class="production-uat-item ${item.passed?"passed":""}" data-uat-id="${escapeHtml(item.id)}" data-uat-passed="${item.passed?"1":"0"}"><span class="uat-check">${item.passed?"✓":""}</span><span><small>${escapeHtml(item.group||"")}</small><b>${escapeHtml(item.label)}</b><em>${escapeHtml(item.detail||"")}</em>${item.passed?`<i>${item.byName?escapeHtml(item.byName):"ผู้ดูแล"}${item.at?` · ${escapeHtml(formatDate(item.at))}`:""}</i>`:""}</span></button>`).join("")}</div><footer><b>${ready?"ผ่านเกณฑ์รอบนี้":"ยังไม่ควรเปิด Production"}</b><span>${ready?"ตรวจอัตโนมัติผ่าน รุ่นตรงกัน และ UAT ครบทุกหัวข้อ":"แก้จุดที่ไม่ผ่านและทดสอบ UAT ให้ครบก่อนเปิดใช้งานจริง"}</span></footer></section>`
}
async function runProductionReadiness(){
  if(adminReadinessState.busy)return;adminReadinessState.busy=true;adminReadinessState.error="";const button=$("healthReadiness");if(button){button.disabled=true;button.textContent="กำลังตรวจ"}
  try{adminReadinessState.data=await api("/api/admin/production-readiness",{timeoutMs:30000,retries:0});renderAdminDiagnosticsContent(adminHealthState.data)}
  catch(error){adminReadinessState.error=error.message||"ตรวจความพร้อมไม่สำเร็จ";recordClientIssue("READINESS",adminReadinessState.error,"/api/admin/production-readiness");await showNotice("error",adminReadinessState.error)}
  finally{adminReadinessState.busy=false;if(button){button.disabled=false;button.textContent="ตรวจความพร้อม"}}
}
async function saveProductionUatItem(itemId,currentPassed){
  const next=!currentPassed;let note="";
  if(next){const result=await Swal.fire({icon:"question",title:"ยืนยันผลทดสอบ",text:"หัวข้อนี้ได้ทดสอบกับระบบจริงแล้วและผลถูกต้องใช่หรือไม่",input:"text",inputPlaceholder:"หมายเหตุ (ไม่บังคับ)",showCancelButton:true,confirmButtonText:"ยืนยันว่าผ่าน",cancelButtonText:"ยกเลิก",reverseButtons:true,customClass:swalClasses(),width:460});if(!result.isConfirmed)return;note=String(result.value||"").trim()}
  else{const result=await Swal.fire({icon:"warning",title:"ยกเลิกผลผ่านหัวข้อนี้?",showCancelButton:true,confirmButtonText:"ยกเลิกผลผ่าน",cancelButtonText:"กลับ",reverseButtons:true,customClass:swalClasses(),width:420});if(!result.isConfirmed)return}
  try{adminReadinessState.data=await api("/api/admin/production-readiness/checklist",{method:"POST",body:{itemId,passed:next,note},timeoutMs:30000,retries:0});renderAdminDiagnosticsContent(adminHealthState.data)}catch(error){await showNotice("error",error.message||"บันทึกผล UAT ไม่สำเร็จ")}
}
async function resetProductionUat(){const result=await Swal.fire({icon:"warning",title:"เริ่ม UAT ใหม่",text:"ผลที่ยืนยันไว้สำหรับรุ่นนี้จะถูกล้างทั้งหมด",showCancelButton:true,confirmButtonText:"เริ่มใหม่",cancelButtonText:"ยกเลิก",reverseButtons:true,customClass:swalClasses(),width:430});if(!result.isConfirmed)return;try{adminReadinessState.data=await api("/api/admin/production-readiness/checklist",{method:"POST",body:{action:"RESET"},timeoutMs:30000,retries:0});renderAdminDiagnosticsContent(adminHealthState.data);await showNotice("success","เริ่มรายการ UAT ใหม่แล้ว")}catch(error){await showNotice("error",error.message||"เริ่ม UAT ใหม่ไม่สำเร็จ")}}
function bindProductionReadinessEvents(){document.querySelectorAll("[data-uat-id]").forEach(button=>button.addEventListener("click",()=>saveProductionUatItem(button.dataset.uatId,button.dataset.uatPassed==="1")));$("productionUatReset")?.addEventListener("click",resetProductionUat)}

function renderAdminDiagnosticsContent(data){const panel=$("adminPanel");if(!panel||adminState.tab!=="health")return;if(!data){panel.innerHTML=`<div class="empty-state"><b>ตรวจระบบไม่สำเร็จ</b><span>${escapeHtml(adminHealthState.error||"กรุณาลองใหม่")}</span><button id="healthRetry" class="primary">ลองใหม่</button></div>`;$("healthRetry")?.addEventListener("click",()=>renderAdminDiagnostics(true));return}const tone=adminHealthTone(data.status),checks=Array.isArray(data.checks)?data.checks:[],repairable=Number(data.repairable?.total||0),latest=data.latestSync,watchdog=data.syncWatchdog;panel.innerHTML=`<div class="admin-section-head clean-admin-head system-health-head"><div><h3>ตรวจระบบ</h3><p>ตรวจฐานข้อมูล การรับข้อมูล ความสัมพันธ์ และค่าที่จำเป็น โดยไม่แก้ข้อมูลปฏิบัติงาน</p></div><div class="system-health-actions"><button id="healthRefresh" class="quiet-button" type="button">ตรวจอีกครั้ง</button><button id="healthPerformance" class="quiet-button" type="button">ทดสอบความเร็ว</button><button id="healthResilience" class="quiet-button" type="button">ทดสอบความทนทาน</button><button id="healthReadiness" class="quiet-button" type="button">ตรวจความพร้อม</button>${repairable?`<button id="healthRepair" class="primary" type="button">ซ่อมส่วนที่ปลอดภัย (${repairable})</button>`:""}</div></div><section class="system-health-summary ${tone}"><div><small>สถานะรวม</small><b>${escapeHtml(data.statusLabel||"-")}</b><span>ใช้เวลา ${Number(data.durationMs||0).toLocaleString("th-TH")} ms</span></div><div><small>Worker</small><b>${escapeHtml(data.build||"-")}</b><span>ตาราง ${Number(data.summary?.tables||0)} · ตัวช่วยค้นหา ${Number(data.summary?.indexes||0)}</span></div><div><small>รับข้อมูล Gate ล่าสุด</small><b>${watchdog?escapeHtml(watchdog.statusLabel||"-"):latest?escapeHtml(String(latest.status||"-")):"ยังไม่มีข้อมูล"}</b><span>${watchdog?.ageLabel?`ผ่านมา ${escapeHtml(watchdog.ageLabel)}`:latest?.finishedAt||latest?.startedAt?formatDate(latest.finishedAt||latest.startedAt):"-"}</span></div></section>${syncWatchdogSettingsHtml(watchdog)}<section class="system-health-grid">${checks.map(item=>`<article class="system-health-check ${adminHealthTone(item.status)}"><span class="system-health-dot"></span><div><b>${escapeHtml(item.label)}</b><p>${escapeHtml(item.detail||"")}</p></div><strong>${item.status==="PASS"?"ผ่าน":item.status==="WARN"?"ตรวจดู":"ต้องแก้"}</strong></article>`).join("")}</section>${adminPerformanceState.data?performanceDiagnosticsHtml(adminPerformanceState.data,adminPerformanceState.client):""}${adminResilienceState.data?resilienceDiagnosticsHtml(adminResilienceState.data,adminResilienceState.client):""}${adminReadinessState.data?productionReadinessHtml(adminReadinessState.data):""}${diagnosticClientHtml()}<section class="system-health-note"><b>ซ่อมส่วนที่ปลอดภัย</b><span>ระบบจัดการเฉพาะ Sync RUNNING ที่ค้างเกินเวลาที่ Admin กำหนด ล้าง Session หมดอายุเกิน 7 วัน และล้าง Cache สรุปข้อมูล ไม่แก้สถานะรถหรือประวัติขั้นตอนงาน</span></section>`;$("healthRefresh")?.addEventListener("click",()=>renderAdminDiagnostics(true));$("healthPerformance")?.addEventListener("click",runAdminPerformanceDiagnostics);$("healthResilience")?.addEventListener("click",runAdminResilienceDiagnostics);$("healthReadiness")?.addEventListener("click",runProductionReadiness);bindProductionReadinessEvents();$("syncWatchdogSave")?.addEventListener("click",saveSyncWatchdogSettings);$("healthRepair")?.addEventListener("click",async()=>{const ok=await Swal.fire({icon:"warning",title:"ซ่อมส่วนที่ปลอดภัย",text:"จะจัดการเฉพาะสถานะ Sync ที่ค้างและ Session ที่หมดอายุ ไม่แก้ข้อมูลรถ",showCancelButton:true,confirmButtonText:"ตรวจและซ่อม",cancelButtonText:"ยกเลิก",reverseButtons:true,customClass:swalClasses(),width:420});if(!ok.isConfirmed)return;const button=$("healthRepair");if(button){button.disabled=true;button.textContent="กำลังตรวจ"}try{const result=await api("/api/admin/diagnostics/repair",{method:"POST",body:{confirmation:"SAFE_REPAIR"},timeoutMs:20000});adminHealthState.data=result.diagnostics;adminHealthState.error="";updateAdminHealthBadge();renderAdminDiagnosticsContent(adminHealthState.data);await showNotice("success",result.message||"ตรวจและซ่อมแล้ว")}catch(error){await showNotice("error",error.message||"ซ่อมไม่สำเร็จ")}})}
async function renderAdminDiagnostics(force=false){const panel=$("adminPanel");if(!panel)return;if(force)adminHealthState.data=null;if(!adminHealthState.data){panel.innerHTML=`<div class="admin-data-loading"><span></span><b>กำลังตรวจระบบ</b><small>ตรวจเฉพาะส่วนสำคัญและไม่แก้ข้อมูล</small></div>`}const data=await ensureAdminHealth(force);renderAdminDiagnosticsContent(data)}

async function renderAdminDataUsage(){
  const panel=$("adminPanel");if(!panel)return;
  panel.innerHTML=`<div class="admin-data-loading"><span></span><b>กำลังตรวจสอบการใช้ข้อมูล</b></div>`;
  try{
    const data=await api("/api/admin/data-usage");
    panel.innerHTML=`<div class="admin-section-head clean-admin-head data-usage-head"><div><h3>การใช้ข้อมูล</h3><p>ดูพื้นที่ ตรวจสอบโครงสร้าง และเก็บข้อมูลย้อนหลังอย่างปลอดภัย</p></div><button id="refreshDataUsage" class="quiet-button" type="button">โหลดใหม่</button></div><nav class="data-tools-tabs" aria-label="ส่วนจัดการข้อมูล"><button type="button" data-data-tool="overview" class="${adminDataTools.tab==="overview"?"active":""}">ภาพรวม</button><button type="button" data-data-tool="structure" class="${adminDataTools.tab==="structure"?"active":""}">โครงสร้าง</button><button type="button" data-data-tool="commands" class="${adminDataTools.tab==="commands"?"active":""}">ชุดคำสั่งตรวจสอบ</button><button type="button" data-data-tool="archive" class="${adminDataTools.tab==="archive"?"active":""}">เก็บข้อมูลย้อนหลัง</button><button type="button" data-data-tool="history" class="${adminDataTools.tab==="history"?"active":""}">ประวัติการเก็บ</button><button type="button" data-data-tool="cleanup" class="${adminDataTools.tab==="cleanup"?"active":""}">เตรียมเคลียร์</button></nav><section id="dataToolsBody"></section>`;
    panel.querySelectorAll("[data-data-tool]").forEach(button=>button.addEventListener("click",async()=>{adminDataTools.tab=button.dataset.dataTool;panel.querySelectorAll("[data-data-tool]").forEach(item=>item.classList.toggle("active",item===button));await renderAdminDataToolBody(data)}));
    $("refreshDataUsage")?.addEventListener("click",()=>{adminDataTools.inspector=null;renderAdminDataUsage()});
    await renderAdminDataToolBody(data);
  }catch(error){panel.innerHTML=`<div class="empty-state"><b>ตรวจสอบการใช้ข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="retryDataUsage" class="primary">ลองใหม่</button></div>`;$("retryDataUsage")?.addEventListener("click",renderAdminDataUsage)}
}

async function renderAdminDataToolBody(data){
  const body=$("dataToolsBody");if(!body)return;
  if(adminDataTools.tab==="overview"){renderAdminDataOverview(body,data);return}
  if(adminDataTools.tab==="archive"){await renderAdminArchive(body);return}
  if(adminDataTools.tab==="history"){await renderAdminArchiveHistory(body);return}
  if(adminDataTools.tab==="cleanup"){await renderAdminCleanup(body);return}
  if(!adminDataTools.inspector){
    body.innerHTML=`<div class="data-inspector-loading"><span></span><b>กำลังอ่านข้อมูลฐานข้อมูล</b><small>เป็นการดูข้อมูลเท่านั้น ไม่มีการแก้ไขหรือลบ</small></div>`;
    if(adminDataTools.busy)return;adminDataTools.busy=true;
    try{adminDataTools.inspector=await api("/api/admin/data-inspector")}catch(error){body.innerHTML=`<div class="empty-state"><b>อ่านข้อมูลฐานข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="retryDataInspector" class="primary">ลองใหม่</button></div>`;$("retryDataInspector")?.addEventListener("click",()=>{adminDataTools.inspector=null;renderAdminDataToolBody(data)});return}finally{adminDataTools.busy=false}
  }
  if(adminDataTools.tab==="structure")renderAdminDataStructure(body,adminDataTools.inspector);else renderAdminSqlCommands(body,adminDataTools.inspector);
}

function renderAdminDataOverview(body,data){
  const used=Number(data.sizeBytes||0),limit=Number(data.maxDatabaseBytes||0),remaining=Number(data.remainingBytes||0),percent=Math.max(0,Math.min(100,Number(data.percent||0))),tone=percent>=95?"danger":percent>=85?"warning":percent>=70?"watch":"ok",status=percent>=95?"ใกล้เต็ม":percent>=85?"ควรตรวจสอบ":percent>=70?"เริ่มใช้พื้นที่มาก":"ปกติ",c=data.counts||{};
  body.innerHTML=`<section class="data-usage-summary"><article class="data-usage-main ${tone}"><div><small>พื้นที่ฐานข้อมูล</small><b>${formatStorage(used)} <em>/ ${formatStorage(limit)}</em></b><span>${status}</span></div><div class="data-usage-ring" style="--usage:${percent}%"><strong>${percent.toFixed(1)}%</strong></div><div class="data-usage-progress"><i style="width:${percent}%"></i></div><footer><span>ใช้แล้ว <b>${formatStorage(used)}</b></span><span>คงเหลือ <b>${formatStorage(remaining)}</b></span></footer></article><article class="data-plan-card"><small>แพ็กเกจปัจจุบัน</small><b>${data.plan==="PAID"?"แบบชำระเงิน":"แบบฟรี"}</b><span>ขีดจำกัดต่อฐานข้อมูล ${formatStorage(limit)}</span></article></section><section class="data-count-grid">${dataCountCard("รถทั้งหมด",c.vehicles)}${dataCountCard("รถที่ยังอยู่ในพื้นที่",c.activeVehicles)}${dataCountCard("ประวัติขั้นตอน",c.workflowEvents)}${dataCountCard("ประวัติการเรียกรถ",c.queueCalls)}${dataCountCard("ปฏิเสธรับสินค้า",c.receivingRejections)}${dataCountCard("ประวัติการจัดการ",c.auditLogs)}${dataCountCard("ผู้ใช้งาน",c.users)}${dataCountCard("ประตู",c.doors)}${dataCountCard("รอบรับข้อมูล",c.syncRuns)}</section><section class="data-history-card"><header><div><h3>ประวัติการทำงานล่าสุด</h3><p>รายการสำคัญที่ระบบบันทึกไว้</p></div><span>${formatDate(data.generatedAt)}</span></header><div class="data-history-list">${renderDataActivity(data.activity||[])}</div></section>`;
}


function previousBangkokMonth(){const now=new Date(),parts=new Intl.DateTimeFormat("en-CA",{timeZone:cfg.timezone,year:"numeric",month:"2-digit"}).formatToParts(now),p=Object.fromEntries(parts.map(x=>[x.type,x.value])),d=new Date(Date.UTC(Number(p.year),Number(p.month)-2,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`}
async function renderAdminArchive(body){
  if(!adminDataTools.archiveMonth)adminDataTools.archiveMonth=previousBangkokMonth();
  if(!adminDataTools.archivePreview||adminDataTools.archivePreview.month!==adminDataTools.archiveMonth){
    body.innerHTML=`<div class="data-inspector-loading"><span></span><b>กำลังตรวจสอบข้อมูลย้อนหลัง</b><small>ยังไม่มีการลบหรือเปลี่ยนข้อมูล</small></div>`;
    if(adminDataTools.archiveBusy)return;adminDataTools.archiveBusy=true;
    try{adminDataTools.archivePreview=await api(`/api/admin/archive-preview?month=${encodeURIComponent(adminDataTools.archiveMonth)}`)}catch(error){body.innerHTML=`<div class="empty-state"><b>ตรวจสอบข้อมูลย้อนหลังไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="retryArchivePreview" class="primary">ลองใหม่</button></div>`;$("retryArchivePreview")?.addEventListener("click",()=>{adminDataTools.archivePreview=null;renderAdminArchive(body)});return}finally{adminDataTools.archiveBusy=false}
  }
  let history=null;try{history=await api("/api/admin/archive-history")}catch{}
  const data=adminDataTools.archivePreview||{},files=(data.files||[]).filter(item=>item.available!==false),ready=Number(data.readyVehicles||0),open=Number(data.openVehicles||0),connected=Boolean(history?.connected),existing=(history?.items||[]).find(item=>item.month===adminDataTools.archiveMonth),verify=adminDataTools.archiveVerify?.month===adminDataTools.archiveMonth?adminDataTools.archiveVerify:null;
  body.innerHTML=`<section class="archive-head"><div><h3>เก็บข้อมูลย้อนหลัง</h3><p>เลือกเดือน ตรวจสอบ แล้วเก็บสำเนาไว้ก่อนเคลียร์ข้อมูลเก่า</p></div><label><span>เดือนที่ต้องการ</span><input id="archiveMonth" type="month" value="${escapeHtml(adminDataTools.archiveMonth)}" min="2020-01" max="2100-12"></label><button id="archiveCheck" class="quiet-button" type="button">ตรวจสอบ</button></section><section class="r2-status-card ${connected?"ready":"off"}"><div><small>พื้นที่เก็บข้อมูล R2</small><b>${connected?"พร้อมใช้งาน":"ยังไม่ได้เชื่อม"}</b><span>${connected?(existing?`เดือนนี้เก็บล่าสุด ${formatDate(existing.createdAt)}`:"สามารถเก็บข้อมูลเดือนนี้ได้"):"ยังดาวน์โหลดไฟล์เก็บเองได้ตามปกติ"}</span></div><div class="r2-status-actions">${connected&&existing?`<button id="archiveVerifyR2" class="quiet-button" type="button">ตรวจความครบถ้วน</button>`:""}${connected?`<button id="archiveStoreR2" class="primary" type="button" ${ready?"":"disabled"}>${existing?"เก็บใหม่ใน R2":"เก็บใน R2"}</button>`:""}</div></section><div class="archive-complete-note"><b>ข้อมูลที่เก็บ</b><span>CSV พร้อมใช้รวมข้อมูลสำคัญของรถหนึ่งคันไว้ในหนึ่งแถว พร้อมวันเวลาและระยะเวลาทุกขั้นตอน ส่วน CSV ต้นฉบับยังเก็บรายละเอียดทุกแถวและทุกเหตุการณ์ไว้ครบ</span></div>${verify?renderArchiveVerifyResult(verify):""}<div class="data-safe-note"><b>ปลอดภัย</b><span>ระบบจะเก็บเฉพาะรถที่จบงานและออกจากพื้นที่แล้ว รายการที่ยังทำงานอยู่จะไม่รวม</span></div><section class="archive-summary"><article><small>รถทั้งหมดในเดือน</small><b>${Number(data.totalVehicles||0).toLocaleString("th-TH")}</b></article><article class="ok"><small>พร้อมเก็บย้อนหลัง</small><b>${ready.toLocaleString("th-TH")}</b></article><article class="warn"><small>ยังไม่จบงาน</small><b>${open.toLocaleString("th-TH")}</b></article><article><small>ช่วงข้อมูล</small><b>${escapeHtml(data.periodLabel||adminDataTools.archiveMonth)}</b></article></section>${open?`<div class="archive-warning"><b>มี ${open.toLocaleString("th-TH")} รายการที่ยังไม่จบงาน</b><span>ระบบจะเว้นรายการเหล่านี้ไว้</span></div>`:""}<section class="archive-files"><header><div><h3>ไฟล์ที่ดาวน์โหลดได้</h3><p>CSV พร้อมใช้สำหรับงานประจำ และ CSV ต้นฉบับสำหรับเก็บรายละเอียดครบทุกส่วน</p></div><div class="archive-download-actions"><button id="archiveReadyCsvDownload" class="primary" type="button">ดาวน์โหลด CSV พร้อมใช้</button><button id="archiveSummaryDownload" class="quiet-button" type="button">ดาวน์โหลดสรุป</button></div></header>${files.map(item=>`<article><div><b>${escapeHtml(item.label)}</b><span>${Number(item.rows||0).toLocaleString("th-TH")} แถว</span></div><button type="button" data-archive-file="${escapeHtml(item.id)}" ${Number(item.rows||0)===0?"disabled":""}>CSV ต้นฉบับ</button></article>`).join("")||`<div class="empty-state">ไม่พบข้อมูลที่พร้อมเก็บย้อนหลัง</div>`}</section><section class="archive-full-backup"><div><h3>สำรองทั้งฐานข้อมูล</h3><p>ใช้เมื่อต้องการเก็บสำเนาทั้งฐานก่อนงานสำคัญ</p></div><button id="copyFullBackupCommand" class="quiet-button" type="button">คัดลอกคำสั่ง</button><pre id="fullBackupCommand">npx wrangler d1 export &lt;ชื่อฐานข้อมูล&gt; --remote --output=./warehouse-vehicle-backup.sql</pre></section>`;
  $("archiveCheck")?.addEventListener("click",()=>{const month=String($("archiveMonth")?.value||"").trim();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;adminDataTools.archiveMonth=month;adminDataTools.archivePreview=null;adminDataTools.archiveVerify=null;renderAdminArchive(body)});
  body.querySelectorAll("[data-archive-file]").forEach(button=>button.addEventListener("click",()=>downloadArchiveFile(button.dataset.archiveFile,button)));
  $("archiveReadyCsvDownload")?.addEventListener("click",()=>downloadArchiveReadyCsv($("archiveReadyCsvDownload")));
  $("archiveSummaryDownload")?.addEventListener("click",()=>downloadArchiveSummary(data));
  $("copyFullBackupCommand")?.addEventListener("click",event=>copyAdminText("npx wrangler d1 export <ชื่อฐานข้อมูล> --remote --output=./warehouse-vehicle-backup.sql",event.currentTarget));
  $("archiveVerifyR2")?.addEventListener("click",async()=>{await verifyArchiveMonth(adminDataTools.archiveMonth,true);await renderAdminArchive(body)});
  $("archiveStoreR2")?.addEventListener("click",async()=>{const button=$("archiveStoreR2");if(!button||button.disabled||adminDataTools.archiveStoreBusy)return;const ok=await Swal.fire({title:"เก็บข้อมูลใน R2",html:`<div style="text-align:left">เดือน <b>${escapeHtml(data.periodLabel||adminDataTools.archiveMonth)}</b><br>รถที่จบงาน <b>${ready.toLocaleString("th-TH")}</b> รายการ<br><br>ระบบจะเก็บทีละส่วนและตรวจแต่ละส่วนก่อนจบ</div>`,showCancelButton:true,confirmButtonText:"ยืนยันเก็บข้อมูล",cancelButtonText:"ยกเลิก",reverseButtons:true});if(!ok.isConfirmed)return;adminDataTools.archiveStoreBusy=true;button.disabled=true;button.textContent="กำลังเตรียม";try{const start=await api("/api/admin/archive-store",{method:"POST",body:{month:adminDataTools.archiveMonth,mode:"start"}}),files=Array.isArray(start.files)?start.files:[];for(let i=0;i<files.length;i++){const file=files[i];button.textContent=`กำลังเก็บ ${i+1}/${files.length}`;await api("/api/admin/archive-store",{method:"POST",body:{month:adminDataTools.archiveMonth,mode:"file",archiveId:start.archiveId,fileId:file.id}})}button.textContent="กำลังตรวจ";const result=await api("/api/admin/archive-store",{method:"POST",body:{month:adminDataTools.archiveMonth,mode:"finish",archiveId:start.archiveId}});adminDataTools.archiveHistory=null;adminDataTools.archiveVerify=null;adminDataTools.cleanupPreview=null;await showNotice("success",result.message||"เก็บข้อมูลเรียบร้อยแล้ว");await verifyArchiveMonth(adminDataTools.archiveMonth,false);await renderAdminArchive(body)}catch(error){await showNotice("error",error.message||"เก็บข้อมูลไม่สำเร็จ")}finally{adminDataTools.archiveStoreBusy=false;if(button){button.disabled=false;button.textContent=existing?"เก็บใหม่ใน R2":"เก็บใน R2"}}});
}
async function renderAdminArchiveHistory(body){
  body.innerHTML=`<div class="data-inspector-loading"><span></span><b>กำลังอ่านประวัติการเก็บข้อมูล</b></div>`;
  if(adminDataTools.archiveHistoryBusy)return;adminDataTools.archiveHistoryBusy=true;
  try{adminDataTools.archiveHistory=await api("/api/admin/archive-history")}catch(error){body.innerHTML=`<div class="empty-state"><b>อ่านประวัติไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span></div>`;return}finally{adminDataTools.archiveHistoryBusy=false}
  const data=adminDataTools.archiveHistory||{},items=Array.isArray(data.items)?data.items:[];
  if(!data.connected){body.innerHTML=`<section class="archive-history-head"><div><h3>ประวัติการเก็บข้อมูล</h3><p>ข้อมูลส่วนนี้จะแสดงเมื่อเชื่อมพื้นที่เก็บข้อมูล R2 แล้ว</p></div></section><div class="cleanup-stop-note"><b>ยังไม่ได้เชื่อม R2</b><span>ไฟล์ที่ดาวน์โหลดไว้ในเครื่องยังใช้เก็บสำรองได้ตามปกติ</span></div>`;return}
  body.innerHTML=`<section class="archive-history-head"><div><h3>ประวัติการเก็บข้อมูล</h3><p>แสดงชุดข้อมูลล่าสุดของแต่ละเดือนที่เก็บไว้ใน R2</p></div><button id="archiveHistoryRefresh" class="quiet-button" type="button">โหลดใหม่</button></section><div class="archive-history-list">${items.map(item=>`<article><div class="archive-history-main"><b>${escapeHtml(item.periodLabel||item.month||"-")}</b><span>เก็บ ${formatDate(item.createdAt)} · รถ ${Number(item.readyVehicles||0).toLocaleString("th-TH")} รายการ</span></div><div class="archive-history-meta"><span>${(item.files||[]).length} ไฟล์</span><span>${escapeHtml(item.createdBy||"ระบบ")}</span><button type="button" data-verify-month="${escapeHtml(item.month||"")}">ตรวจความครบถ้วน</button></div><div class="archive-history-files">${item.report?.key?`<button type="button" class="primary" data-r2-file="${escapeHtml(item.report.key)}">${String(item.report.filename||"").toLowerCase().endsWith(".csv")?"ดาวน์โหลด CSV พร้อมใช้":"ดาวน์โหลดไฟล์พร้อมใช้"}</button>`:""}${(item.files||[]).map(file=>`<button type="button" data-r2-file="${escapeHtml(file.key||"")}">${escapeHtml(file.label||file.filename||"ไฟล์")}</button>`).join("")}</div>${adminDataTools.archiveVerify?.month===item.month?renderArchiveVerifyResult(adminDataTools.archiveVerify):""}</article>`).join("")||`<div class="empty-state">ยังไม่มีข้อมูลที่เก็บใน R2</div>`}</div>`;
  $("archiveHistoryRefresh")?.addEventListener("click",()=>{adminDataTools.archiveHistory=null;renderAdminArchiveHistory(body)});
  body.querySelectorAll("[data-r2-file]").forEach(button=>button.addEventListener("click",()=>downloadR2ArchiveFile(button.dataset.r2File,button)));
  body.querySelectorAll("[data-verify-month]").forEach(button=>button.addEventListener("click",async()=>{await verifyArchiveMonth(button.dataset.verifyMonth,true);await renderAdminArchiveHistory(body)}));
}
function renderArchiveVerifyResult(data){const files=Array.isArray(data.files)?data.files:[],complete=Boolean(data.complete);return `<section class="archive-verify ${complete?"ok":"warn"}"><header><div><small>ผลตรวจข้อมูลใน R2</small><b>${complete?"ครบและตรงกัน":"ต้องตรวจสอบ"}</b><span>${escapeHtml(data.message||"")}</span></div><strong>${files.filter(x=>x.ok).length}/${files.length} ไฟล์</strong></header>${files.length?`<div class="archive-verify-files">${files.map(file=>`<span class="${file.ok?"ok":"bad"}"><b>${escapeHtml(file.label||file.id||"ไฟล์")}</b><small>${Number(file.rows||0).toLocaleString("th-TH")} แถว · ${Number(file.columnCount||0).toLocaleString("th-TH")} ช่อง ${file.ok?"· ครบ":`· ${escapeHtml(file.reason||"ต้องตรวจ")}`}</small></span>`).join("")}</div>`:""}</section>`}
async function verifyArchiveMonth(month,notify=true){if(!month||adminDataTools.archiveVerifyBusy)return null;adminDataTools.archiveVerifyBusy=true;try{const result=await api(`/api/admin/archive-verify?month=${encodeURIComponent(month)}`);adminDataTools.archiveVerify=result;if(notify)await showNotice(result.complete?"success":"warning",result.message||"ตรวจสอบแล้ว");return result}catch(error){if(notify)await showNotice("error",error.message||"ตรวจสอบไม่สำเร็จ");return null}finally{adminDataTools.archiveVerifyBusy=false}}

async function downloadArchiveReadyCsv(button){
  const original=button?.textContent||"ดาวน์โหลด CSV พร้อมใช้";if(button){button.disabled=true;button.textContent="กำลังเตรียม CSV"}
  try{const url=cfg.apiBaseUrl.replace(/\/$/,"")+`/api/admin/archive-ready-csv?month=${encodeURIComponent(adminDataTools.archiveMonth)}`,headers={};if(state.token)headers.authorization=`Bearer ${state.token}`;const response=await fetch(url,{headers});if(!response.ok){let message="เตรียมไฟล์ CSV ไม่สำเร็จ";try{const data=await response.json();message=data.message||message}catch{}throw new Error(message)}const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement("a"),disposition=response.headers.get("content-disposition")||"",match=disposition.match(/filename="?([^";]+)"?/i);link.href=href;link.download=match?.[1]||`Warehouse_Vehicle_${adminDataTools.archiveMonth}_Ready.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);if(button){button.textContent="ดาวน์โหลดแล้ว";setTimeout(()=>button.textContent=original,1200)}}catch(error){if(button)button.textContent=original;await showNotice("error",error.message||"เตรียมไฟล์ CSV ไม่สำเร็จ")}finally{if(button)button.disabled=false}
}
async function downloadR2ArchiveFile(key,button){if(!key)return;const original=button?.textContent||"ดาวน์โหลด";if(button){button.disabled=true;button.textContent="กำลังดาวน์โหลด"}try{const url=cfg.apiBaseUrl.replace(/\/$/,"")+`/api/admin/archive-file?key=${encodeURIComponent(key)}`,headers={};if(state.token)headers.authorization=`Bearer ${state.token}`;const response=await fetch(url,{headers});if(!response.ok)throw new Error("ดาวน์โหลดไม่สำเร็จ");const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement("a"),disposition=response.headers.get("content-disposition")||"",match=disposition.match(/filename="?([^";]+)"?/i);link.href=href;link.download=match?.[1]||key.split("/").pop()||"archive.csv";document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),2000)}catch(error){await showNotice("error",error.message||"ดาวน์โหลดไม่สำเร็จ")}finally{if(button){button.disabled=false;button.textContent=original}}}
async function downloadArchiveFile(file,button){
  if(button?.disabled)return;const original=button?.textContent||"ดาวน์โหลด CSV";button.disabled=true;button.textContent="กำลังเตรียม";
  try{const url=cfg.apiBaseUrl.replace(/\/$/,"")+`/api/admin/archive-export?month=${encodeURIComponent(adminDataTools.archiveMonth)}&file=${encodeURIComponent(file)}`,headers={};if(state.token)headers.authorization=`Bearer ${state.token}`;const response=await fetch(url,{headers});if(!response.ok){let message="ดาวน์โหลดไม่สำเร็จ";try{const data=await response.json();message=data.message||message}catch{}throw new Error(message)}const blob=await response.blob(),href=URL.createObjectURL(blob),link=document.createElement("a"),disposition=response.headers.get("content-disposition")||"",match=disposition.match(/filename="?([^";]+)"?/i);link.href=href;link.download=match?.[1]||`Warehouse_Vehicle_${adminDataTools.archiveMonth}_${file}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),2000);button.textContent="ดาวน์โหลดแล้ว";setTimeout(()=>button.textContent=original,1200)}catch(error){button.textContent=original;await showNotice("error",error.message||"ดาวน์โหลดไม่สำเร็จ")}finally{button.disabled=false}
}
function downloadArchiveSummary(data){const clean={createdAt:formatDate(data.generatedAt),month:data.month,period:data.periodLabel,totalVehicles:Number(data.totalVehicles||0),readyVehicles:Number(data.readyVehicles||0),openVehicles:Number(data.openVehicles||0),files:(data.files||[]).map(item=>({name:item.label,rows:Number(item.rows||0)}))},blob=new Blob([JSON.stringify(clean,null,2)],{type:"application/json;charset=utf-8"}),href=URL.createObjectURL(blob),link=document.createElement("a");link.href=href;link.download=`Warehouse_Vehicle_${data.month||adminDataTools.archiveMonth}_summary.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1500)}


function defaultCleanupMonth(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:cfg.timezone,year:"numeric",month:"2-digit"}).formatToParts(new Date()),p=Object.fromEntries(parts.map(x=>[x.type,x.value])),d=new Date(Date.UTC(Number(p.year),Number(p.month)-1-13,1));return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,"0")}`}
async function renderAdminCleanup(body){
  if(!adminDataTools.cleanupMonth)adminDataTools.cleanupMonth=defaultCleanupMonth();
  if(!adminDataTools.cleanupPreview||adminDataTools.cleanupPreview.month!==adminDataTools.cleanupMonth){
    body.innerHTML=`<div class="data-inspector-loading"><span></span><b>กำลังตรวจสอบข้อมูลก่อนเคลียร์</b><small>ยังไม่มีการลบหรือเปลี่ยนข้อมูล</small></div>`;
    if(adminDataTools.cleanupBusy)return;adminDataTools.cleanupBusy=true;
    try{adminDataTools.cleanupPreview=await api(`/api/admin/cleanup-preview?month=${encodeURIComponent(adminDataTools.cleanupMonth)}`);adminDataTools.cleanupScript=null}catch(error){body.innerHTML=`<div class="empty-state"><b>ตรวจสอบข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message)}</span><button id="retryCleanupPreview" class="primary">ลองใหม่</button></div>`;$('retryCleanupPreview')?.addEventListener('click',()=>{adminDataTools.cleanupPreview=null;renderAdminCleanup(body)});return}finally{adminDataTools.cleanupBusy=false}
  }
  if(!adminDataTools.cleanupHistory){try{adminDataTools.cleanupHistory=await api("/api/admin/cleanup-history")}catch{adminDataTools.cleanupHistory={items:[]}}}
  const data=adminDataTools.cleanupPreview||{},safe=Boolean(data.safe),ready=Number(data.readyVehicles||0),open=Number(data.openVehicles||0),related=(data.counts||[]).reduce((sum,item)=>sum+Number(item.rows||0),0),messages=Array.isArray(data.messages)?data.messages:[],r2Connected=Boolean(data.archive?.connected),r2Stored=Boolean(data.archive?.stored),r2Complete=Boolean(data.archive?.complete),historyItems=Array.isArray(adminDataTools.cleanupHistory?.items)?adminDataTools.cleanupHistory.items:[];
  body.innerHTML=`<section class="cleanup-head"><div><h3>เตรียมเคลียร์ข้อมูลเก่า</h3><p>ระบบจะเก็บรถที่ยังทำงานอยู่ และเคลียร์เฉพาะรถที่จบงานแล้ว</p></div><label><span>เดือนที่ต้องการ</span><input id="cleanupMonth" type="month" value="${escapeHtml(adminDataTools.cleanupMonth)}" min="2020-01" max="2100-12"></label><button id="cleanupCheck" class="quiet-button" type="button">ตรวจสอบ</button></section><div class="${safe?"data-safe-note":"cleanup-stop-note"}"><b>${safe?"พร้อมตรวจขั้นสุดท้าย":"ยังไม่พร้อม"}</b><span>${safe?"ระบบตรวจข้อมูลที่เกี่ยวข้องแล้ว ก่อนเคลียร์จะตรวจสำเนาใน R2 ซ้ำอีกครั้ง":"ระบบจะไม่ให้เคลียร์จนกว่าจะผ่านทุกข้อ"}</span></div><section class="cleanup-summary"><article><small>รถทั้งหมดในเดือน</small><b>${Number(data.totalVehicles||0).toLocaleString("th-TH")}</b></article><article class="ok"><small>พร้อมเคลียร์</small><b>${ready.toLocaleString("th-TH")}</b></article><article class="keep"><small>ต้องเก็บไว้</small><b>${open.toLocaleString("th-TH")}</b><span>ยังไม่จบงาน</span></article><article><small>ข้อมูลที่เกี่ยวข้อง</small><b>${related.toLocaleString("th-TH")}</b></article></section>${messages.length?`<div class="cleanup-messages">${messages.map(message=>`<span>${escapeHtml(message)}</span>`).join("")}</div>`:""}<section class="cleanup-checks"><header><h3>ตรวจความพร้อม</h3><span>ต้องผ่านทุกข้อก่อน</span></header>${(data.checks||[]).map(item=>`<div class="${item.ok?"pass":"fail"}"><i>${item.ok?"✓":"!"}</i><span>${escapeHtml(item.label)}</span><b>${item.ok?"ผ่าน":"ตรวจสอบ"}</b></div>`).join("")}</section><section class="cleanup-counts"><header><h3>ข้อมูลที่จะเกี่ยวข้อง</h3><span>ใช้ตรวจสอบจำนวนก่อนดำเนินการ</span></header>${(data.counts||[]).map(item=>`<div><span>${escapeHtml(item.label)}</span><b>${Number(item.rows||0).toLocaleString("th-TH")} แถว</b></div>`).join("")}</section>${r2Connected?`<div class="cleanup-r2-state ${r2Complete?"ready":"missing"}"><div><b>${r2Complete?"สำเนาใน R2 ครบและตรวจผ่าน":r2Stored?"มีสำเนา แต่ยังตรวจไม่ผ่าน":"ยังไม่มีสำเนาใน R2"}</b><span>${r2Complete?`เก็บล่าสุด ${formatDate(data.archive?.createdAt)}`:r2Stored?"กลับไปตรวจความครบถ้วนหรือเก็บใหม่ก่อน":"กลับไปที่ “เก็บข้อมูลย้อนหลัง” แล้วเก็บเดือนนี้ก่อน"}</span></div>${r2Complete?`<strong>พร้อม</strong>`:""}</div>`:""}<label class="cleanup-confirm"><input id="cleanupArchiveConfirmed" type="checkbox" ${safe&&r2Complete?"":"disabled"}><span><b>ฉันตรวจสอบสำเนาใน R2 แล้ว</b><small>รถที่ยังไม่จบงานจะไม่ถูกเคลียร์</small></span></label><div class="cleanup-actions"><button id="cleanupVerify" class="quiet-button" type="button">ตรวจผลหลังเคลียร์</button><button id="cleanupBuild" class="quiet-button" type="button" ${safe?"":"disabled"}>สร้างชุดคำสั่ง</button><button id="cleanupExecute" class="danger-button" type="button" disabled>เคลียร์ข้อมูลจริง</button></div><section id="cleanupVerifyArea"></section><section id="cleanupScriptArea"></section>${renderCleanupHistory(historyItems)}</section>`;
  $("cleanupCheck")?.addEventListener("click",()=>{const month=String($("cleanupMonth")?.value||"").trim();if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;adminDataTools.cleanupMonth=month;adminDataTools.cleanupPreview=null;adminDataTools.cleanupScript=null;adminDataTools.cleanupVerify=null;renderAdminCleanup(body)});
  const confirm=$("cleanupArchiveConfirmed"),build=$("cleanupBuild"),execute=$("cleanupExecute");
  const updateCleanupButtons=()=>{if(build)build.disabled=!safe||!confirm?.checked;if(execute)execute.disabled=!safe||!r2Complete||!confirm?.checked||adminDataTools.cleanupExecuteBusy};confirm?.addEventListener("change",updateCleanupButtons);updateCleanupButtons();
  build?.addEventListener("click",async()=>{if(!confirm?.checked)return;build.disabled=true;build.textContent="กำลังเตรียม";try{adminDataTools.cleanupScript=await api(`/api/admin/cleanup-script?month=${encodeURIComponent(adminDataTools.cleanupMonth)}`);renderCleanupScriptArea($("cleanupScriptArea"),adminDataTools.cleanupScript)}catch(error){await showNotice("error",error.message||"สร้างชุดคำสั่งไม่สำเร็จ")}finally{build.textContent="สร้างชุดคำสั่ง";updateCleanupButtons()}});
  execute?.addEventListener("click",async()=>{if(!confirm?.checked||!safe||!r2Complete||adminDataTools.cleanupExecuteBusy)return;const month=adminDataTools.cleanupMonth,expected=`ยืนยัน ${month}`;const first=await Swal.fire({icon:"warning",title:"ยืนยันเคลียร์ข้อมูลเก่า",html:`<div style="text-align:left;line-height:1.65">เดือน <b>${escapeHtml(data.periodLabel||month)}</b><br>รถที่จะเคลียร์ <b>${ready.toLocaleString("th-TH")}</b> รายการ<br>รถที่ยังไม่จบงานและจะเก็บไว้ <b>${open.toLocaleString("th-TH")}</b> รายการ<br><br>ระบบจะตรวจสำเนาใน R2 อีกครั้งก่อนเริ่ม</div>`,showCancelButton:true,confirmButtonText:"ตรวจขั้นสุดท้าย",cancelButtonText:"ยกเลิก",reverseButtons:true,customClass:swalClasses(),width:440});if(!first.isConfirmed)return;const second=await Swal.fire({title:"พิมพ์คำยืนยัน",html:`<div style="text-align:left;margin-bottom:8px">พิมพ์ <b>${escapeHtml(expected)}</b> เพื่อยืนยัน</div>`,input:"text",inputPlaceholder:expected,showCancelButton:true,confirmButtonText:"เคลียร์ข้อมูล",cancelButtonText:"ยกเลิก",reverseButtons:true,preConfirm:value=>{if(String(value||"").trim()!==expected){Swal.showValidationMessage(`กรุณาพิมพ์ ${expected} ให้ตรง`);return false}return String(value).trim()},customClass:swalClasses(),width:420});if(!second.isConfirmed)return;adminDataTools.cleanupExecuteBusy=true;execute.disabled=true;execute.textContent="กำลังเคลียร์";try{const result=await api("/api/admin/cleanup-execute",{method:"POST",body:{month,confirmation:second.value}});adminDataTools.cleanupPreview=null;adminDataTools.cleanupScript=null;adminDataTools.cleanupVerify=null;adminDataTools.cleanupHistory=null;adminDataTools.archivePreview=null;adminDataTools.archiveHistory=null;await Swal.fire({icon:"success",title:"เคลียร์ข้อมูลเรียบร้อย",html:`<div style="text-align:left;line-height:1.65">เคลียร์รถเก่า <b>${Number(result.removedVehicles||0).toLocaleString("th-TH")}</b> รายการ<br>รถที่ยังทำงานและเก็บไว้ <b>${Number(result.keptVehicles||0).toLocaleString("th-TH")}</b> รายการ<br>สำเนาใน R2 ยังคงอยู่ครบ</div>`,confirmButtonText:"ตกลง",customClass:swalClasses(),width:430});await renderAdminCleanup(body)}catch(error){await showNotice("error",error.message||"เคลียร์ข้อมูลไม่สำเร็จ")}finally{adminDataTools.cleanupExecuteBusy=false;if(execute){execute.textContent="เคลียร์ข้อมูลจริง"}updateCleanupButtons()}});
  $("cleanupVerify")?.addEventListener("click",async()=>{const button=$("cleanupVerify"),area=$("cleanupVerifyArea");if(button){button.disabled=true;button.textContent="กำลังตรวจ"}try{const result=await api(`/api/admin/cleanup-verify?month=${encodeURIComponent(adminDataTools.cleanupMonth)}`);adminDataTools.cleanupVerify=result;if(area)area.innerHTML=`<div class="cleanup-verify-result ${result.verified?"ok":"warn"}"><b>${result.verified?"ตรวจเรียบร้อย":"ยังไม่เรียบร้อย"}</b><span>${escapeHtml(result.message||"")}</span><small>รถที่จบงานยังเหลือ ${Number(result.remaining||0).toLocaleString("th-TH")} รายการ${result.archiveConnected?` · R2 ${result.archiveComplete?"ครบ":"ต้องตรวจ"}`:""}</small></div>`}catch(error){if(area)area.innerHTML=`<div class="cleanup-verify-result warn"><b>ตรวจไม่สำเร็จ</b><span>${escapeHtml(error.message||"กรุณาลองใหม่")}</span></div>`}finally{if(button){button.disabled=false;button.textContent="ตรวจผลหลังเคลียร์"}}});
  if(adminDataTools.cleanupScript)renderCleanupScriptArea($("cleanupScriptArea"),adminDataTools.cleanupScript);
}
function renderCleanupHistory(items){const recent=(Array.isArray(items)?items:[]).slice(0,8);return `<section class="cleanup-history"><header><div><h3>ประวัติการเคลียร์ข้อมูล</h3><p>เก็บบันทึกว่าเคลียร์เดือนไหน เมื่อไร และโดยใคร</p></div></header>${recent.length?`<div>${recent.map(item=>`<article><div><b>${escapeHtml(item.periodLabel||item.month||"-")}</b><span>${formatDate(item.createdAt)} · ${escapeHtml(item.actor||"ระบบ")}</span></div><strong>${Number(item.removedVehicles||0).toLocaleString("th-TH")} รายการ</strong><small>สำเนา R2: ${escapeHtml(item.archiveId||"มีการตรวจสอบก่อนเคลียร์")}</small></article>`).join("")}</div>`:`<div class="empty-state">ยังไม่มีประวัติการเคลียร์ข้อมูล</div>`}</section>`}

function renderCleanupScriptArea(area,data){if(!area||!data)return;const steps=Array.isArray(data.steps)?data.steps:[];area.innerHTML=`<section class="cleanup-script"><header><div><h3>ชุดคำสั่งสำหรับ ${escapeHtml(data.periodLabel||data.month||"")}</h3><p>ให้ทำทีละข้อจากบนลงล่าง และตรวจจำนวนก่อนเริ่ม</p></div><button id="downloadCleanupScript" class="quiet-button" type="button">ดาวน์โหลดไฟล์</button></header><div class="cleanup-script-warning"><b>สำคัญ</b><span>คำสั่งเหล่านี้ยังไม่ได้ทำงาน ต้องคัดลอกไปใช้เองในหน้าคำสั่ง Cloudflare เท่านั้น</span></div><div class="cleanup-step-list">${steps.map((step,index)=>`<article class="${step.kind||""}"><div class="cleanup-step-no">${index+1}</div><div><b>${escapeHtml(step.label)}</b><span>${Number(step.rows||0).toLocaleString("th-TH")} แถว</span></div><button type="button" data-copy-cleanup="${escapeHtml(step.id)}">คัดลอก</button><pre>${escapeHtml(step.sql||"")}</pre></article>`).join("")}</div></section>`;area.querySelectorAll("[data-copy-cleanup]").forEach(button=>button.addEventListener("click",()=>{const step=steps.find(item=>item.id===button.dataset.copyCleanup);if(step)copyAdminText(step.sql,button)}));$("downloadCleanupScript")?.addEventListener("click",()=>downloadCleanupScript(data))}
function downloadCleanupScript(data){const text=String(data.downloadText||"").trim();if(!text)return;const blob=new Blob([text],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`Warehouse_Vehicle_${data.month||adminDataTools.cleanupMonth}_cleanup.sql`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}

function renderAdminDataStructure(body,data){
  const tables=Array.isArray(data.tables)?data.tables:[];
  body.innerHTML=`<section class="data-structure-head"><div><h3>โครงสร้างฐานข้อมูล</h3><p>ข้อมูลที่อ่านจากฐานปัจจุบัน ใช้สำหรับตรวจสอบและเก็บสำรอง</p></div><div class="data-structure-actions"><button id="copyAllSchema" class="quiet-button" type="button">คัดลอกทั้งหมด</button><button id="downloadSchema" class="primary" type="button">ดาวน์โหลดไฟล์</button></div></section><div class="data-safe-note"><b>ปลอดภัย</b><span>ส่วนนี้ดูและคัดลอกเท่านั้น ไม่มีปุ่มลบหรือแก้ตาราง</span></div><section class="data-structure-summary"><article><small>ตาราง</small><b>${Number(data.summary?.tables||tables.length).toLocaleString("th-TH")}</b></article><article><small>คำสั่งโครงสร้าง</small><b>${Number(data.summary?.statements||0).toLocaleString("th-TH")}</b></article><article><small>คำสั่งตรวจสอบ</small><b>${Number(data.summary?.commands||0).toLocaleString("th-TH")}</b></article></section><div class="data-table-list">${tables.map(table=>renderDataTableCard(table)).join("")||`<div class="empty-state">ไม่พบข้อมูลตาราง</div>`}</div><section class="data-all-schema"><header><div><h3>คำสั่งโครงสร้างทั้งหมด</h3><p>แยกเป็นรายการเพื่อคัดลอกทีละคำสั่งได้</p></div></header><div>${(data.schema||[]).map(item=>renderDataSchemaCard(item)).join("")}</div></section>`;
  body.querySelectorAll("[data-open-table]").forEach(button=>button.addEventListener("click",()=>{adminDataTools.openTable=adminDataTools.openTable===button.dataset.openTable?"":button.dataset.openTable;renderAdminDataStructure(body,data)}));
  body.querySelectorAll("[data-copy-table]").forEach(button=>button.addEventListener("click",()=>{const table=tables.find(item=>item.name===button.dataset.copyTable);if(table)copyAdminText([table.createSql,...(table.indexSql||[]).map(item=>item.sql)].filter(Boolean).map(ensureSqlEnding).join("\n\n"),button)}));
  body.querySelectorAll("[data-open-schema]").forEach(button=>button.addEventListener("click",()=>{adminDataTools.openSchema=adminDataTools.openSchema===button.dataset.openSchema?"":button.dataset.openSchema;renderAdminDataStructure(body,data)}));
  body.querySelectorAll("[data-copy-schema]").forEach(button=>button.addEventListener("click",()=>{const item=(data.schema||[]).find(entry=>`${entry.type}:${entry.name}`===button.dataset.copySchema);if(item)copyAdminText(ensureSqlEnding(item.sql),button)}));
  $("copyAllSchema")?.addEventListener("click",event=>copyAdminText(String(data.schemaSql||""),event.currentTarget));
  $("downloadSchema")?.addEventListener("click",()=>downloadAdminSchema(data.schemaSql||""));
}

function renderDataSchemaCard(item){const key=`${item.type}:${item.name}`,open=adminDataTools.openSchema===key,label=({table:"ตาราง",index:"รายการช่วยค้นหา",view:"มุมมองข้อมูล",trigger:"คำสั่งอัตโนมัติ"})[item.type]||item.type;return`<article class="data-schema-card ${open?"open":""}"><div><button type="button" data-open-schema="${escapeHtml(key)}"><b>${escapeHtml(item.name)}</b><span>${escapeHtml(label)}${item.tableName&&item.tableName!==item.name?` · ${escapeHtml(item.tableName)}`:""}</span></button><button type="button" data-copy-schema="${escapeHtml(key)}">คัดลอก</button></div>${open?`<pre>${escapeHtml(ensureSqlEnding(item.sql||""))}</pre>`:""}</article>`}

function renderDataTableCard(table){
  const open=adminDataTools.openTable===table.name,columns=Array.isArray(table.columns)?table.columns:[],indexes=Array.isArray(table.quickSearch)?table.quickSearch:[];
  return `<article class="data-table-card ${open?"open":""}"><header><button type="button" data-open-table="${escapeHtml(table.name)}"><span><b>${escapeHtml(table.name)}</b><small>${columns.length} ช่องข้อมูล · ${indexes.length} รายการช่วยค้นหา</small></span><i>${open?"−":"+"}</i></button><button type="button" data-copy-table="${escapeHtml(table.name)}">คัดลอก</button></header>${open?`<div class="data-table-detail"><div class="data-column-grid">${columns.map(column=>`<span><b>${escapeHtml(column.name)}</b><small>${escapeHtml(column.type||"ไม่ระบุ")}${column.primaryKey?" · รหัสหลัก":""}${column.required?" · ต้องมีข้อมูล":""}</small></span>`).join("")}</div><div class="data-sql-preview"><div><b>คำสั่งสร้างตาราง</b><button type="button" data-copy-table="${escapeHtml(table.name)}">คัดลอก</button></div><pre>${escapeHtml(ensureSqlEnding(table.createSql||""))}</pre></div>${indexes.length?`<div class="data-index-list"><b>รายการช่วยค้นหา</b>${indexes.map(item=>`<span>${escapeHtml(item.name)}${item.unique?" · ไม่ให้ค่าซ้ำ":""}</span>`).join("")}</div>`:""}</div>`:""}</article>`;
}

function renderAdminSqlCommands(body,data){
  const commands=Array.isArray(data.commands)?data.commands:[],groups=[...new Set(commands.map(item=>item.group))];
  body.innerHTML=`<section class="data-commands-head"><div><h3>ชุดคำสั่งตรวจสอบ</h3><p>เลือกคำสั่งแล้วกดคัดลอก เพื่อนำไปใช้ในหน้าคำสั่งของ Cloudflare</p></div></section><div class="data-safe-note"><b>รอบนี้มีเฉพาะคำสั่งดูข้อมูล</b><span>ไม่มีคำสั่งลบ เปลี่ยน หรือสร้างตาราง</span></div><div class="data-command-groups">${groups.map(group=>`<section><h4>${escapeHtml(group)}</h4>${commands.filter(item=>item.group===group).map(item=>renderDataCommandCard(item)).join("")}</section>`).join("")}</div>`;
  body.querySelectorAll("[data-open-command]").forEach(button=>button.addEventListener("click",()=>{adminDataTools.openCommand=adminDataTools.openCommand===button.dataset.openCommand?"":button.dataset.openCommand;renderAdminSqlCommands(body,data)}));
  body.querySelectorAll("[data-copy-command]").forEach(button=>button.addEventListener("click",()=>{const command=commands.find(item=>item.id===button.dataset.copyCommand);if(command)copyAdminText(command.sql,button)}));
}

function renderDataCommandCard(item){const open=adminDataTools.openCommand===item.id;return`<article class="data-command-card ${open?"open":""}"><div><button type="button" data-open-command="${escapeHtml(item.id)}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.note||"")}</span></button><button type="button" data-copy-command="${escapeHtml(item.id)}">คัดลอก</button></div>${open?`<pre>${escapeHtml(String(item.sql||""))}</pre>`:""}</article>`}
function ensureSqlEnding(sql){const text=String(sql||"").trim();return text&&!text.endsWith(";")?text+";":text}
async function copyAdminText(text,button){const value=String(text||"");if(!value)return;let ok=false;try{await navigator.clipboard.writeText(value);ok=true}catch{}if(!ok){const area=document.createElement("textarea");area.value=value;area.style.position="fixed";area.style.opacity="0";document.body.appendChild(area);area.select();try{ok=document.execCommand("copy")}catch{}area.remove()}if(button){const old=button.textContent;button.textContent=ok?"คัดลอกแล้ว":"คัดลอกไม่สำเร็จ";setTimeout(()=>button.textContent=old,1200)}}
function downloadAdminSchema(sql){const value=String(sql||"").trim();if(!value)return;const blob=new Blob([value],{type:"text/plain;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a"),date=new Intl.DateTimeFormat("en-CA",{timeZone:cfg.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()).replace(/-/g,"");link.href=url;link.download=`Warehouse_Vehicle_D1_Structure_${date}.sql`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}


function currentBangkokMonth(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:cfg.timezone,year:"numeric",month:"2-digit"}).formatToParts(new Date());const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${p.year}-${p.month}`}
function renderAdminMonthlyExport(){
  const panel=$("adminPanel");if(!panel)return;
  const month=currentBangkokMonth();
  panel.innerHTML=`<div class="admin-section-head clean-admin-head export-head"><div><h3>ส่งออกข้อมูลรายเดือน</h3><p>เลือกเดือนแล้วดาวน์โหลดข้อมูลรถและช่วงเวลาการทำงานจากประวัติในระบบ ไฟล์ไม่แก้ไขข้อมูลต้นทาง</p></div></div><section class="monthly-export-card"><div class="monthly-export-controls"><label><span>เดือนที่ต้องการ</span><input id="monthlyExportMonth" type="month" value="${month}" min="2020-01" max="2100-12"></label><div class="monthly-export-format"><small>รูปแบบไฟล์</small><b>CSV สำหรับ Excel</b><span>รองรับภาษาไทยและเปิดด้วย Microsoft Excel ได้</span></div><button id="monthlyExportButton" class="primary" type="button">ดาวน์โหลดข้อมูล</button></div><div id="monthlyExportStatus" class="monthly-export-status"><b>ข้อมูลที่จะส่งออก</b><span>Auto ID, หมายเลขนัดหมาย, บริษัท, คนขับ, ทะเบียน, กะ, ประตู, เวลาทุกขั้นตอน และระยะเวลาแต่ละช่วง</span></div></section><section class="monthly-export-note"><b>หลักการเลือกข้อมูล</b><span>ใช้วันที่ Gate In เป็นเดือนหลักของไฟล์ รถที่เข้าพื้นที่ในเดือนที่เลือกจะอยู่ในไฟล์เดียวกัน แม้ Gate Out จะเกิดในเดือนถัดไป</span></section>`;
  $("monthlyExportButton")?.addEventListener("click",downloadMonthlyExport);
}
async function downloadMonthlyExport(){
  const month=String($("monthlyExportMonth")?.value||"").trim(),button=$("monthlyExportButton"),status=$("monthlyExportStatus");
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)){await showNotice("warning","กรุณาเลือกเดือนที่ต้องการส่งออก");return}
  if(button?.disabled)return;const original=button?.textContent||"ดาวน์โหลดข้อมูล";if(button){button.disabled=true;button.textContent="กำลังเตรียมไฟล์"}
  try{
    const data=await api(`/api/admin/monthly-export?month=${encodeURIComponent(month)}`),items=Array.isArray(data.items)?data.items:[];
    if(!items.length){if(status)status.innerHTML=`<b>ไม่พบข้อมูล</b><span>ไม่มีรถที่ Gate In ในเดือน ${escapeHtml(month)}</span>`;await showNotice("info","ไม่พบข้อมูลในเดือนที่เลือก");return}
    const headers=["รหัสรถ (Auto ID)","หมายเลขนัดหมาย","บริษัท","ชื่อคนขับ","โทรศัพท์","ทะเบียนรถ","จังหวัด","ประเภทรถ","กะ","วันที่เริ่มกะ","เวลากะ","ประตู","รถเข้าพื้นที่","ยื่นเอกสาร","ตรวจเอกสารเสร็จ","เรียกรถครั้งแรก","เรียกรถล่าสุด","จำนวนครั้งที่เรียก","เริ่มตรวจรับ","รับสินค้าเสร็จ","เวลาปฏิเสธรับสินค้า","เหตุผลปฏิเสธ","รายละเอียดปฏิเสธ","หัวหน้างานรับทราบ","ตำแหน่งหัวหน้างาน","สถานะก่อนปฏิเสธ","ต้องคืนเอกสารหลังปฏิเสธ","รับเอกสารคืน","ออกจากพื้นที่","สถานะสุดท้าย","รถเข้า → ยื่นเอกสาร","ยื่นเอกสาร → ตรวจเอกสารเสร็จ","ตรวจเอกสารเสร็จ → เริ่มตรวจรับ","ยื่นเอกสาร → เริ่มตรวจรับ (รวม)","เรียกรถครั้งแรก → เริ่มตรวจรับ","ระยะเวลาตรวจรับ","รับสินค้าเสร็จ → รับเอกสารคืน","รับเอกสารคืน → ออกจากพื้นที่","เวลารวมในพื้นที่"];
    const rows=items.map(item=>[item.autoId,item.appointmentNo,item.companyName,item.driverName,item.phone,item.vehiclePlate,item.province,item.vehicleType,item.shiftName,item.shiftBusinessDate||"",item.shiftStartMinute==null||item.shiftEndMinute==null?"":`${minuteToTime(item.shiftStartMinute)}–${minuteToTime(item.shiftEndMinute)}`,item.doorCode,formatDate(item.gateInAt),formatDate(item.documentSubmittedAt),formatDate(item.documentCheckedAt),formatDate(item.firstCalledAt),formatDate(item.lastCalledAt),Number(item.queueCallCount||0),formatDate(item.receivingStartedAt),formatDate(item.receivingCompletedAt),formatDate(item.rejectedAt),item.rejectionReason,item.rejectionDetail,item.rejectionSupervisor,item.rejectionSupervisorPosition,item.rejectionFromStatus,item.rejectedAt?(item.rejectionRequireDocumentReturn?"ต้องคืนเอกสาร":"ไม่ต้องคืนเอกสาร"):"",formatDate(item.documentReturnedAt),formatDate(item.gateOutAt),monthlyExportStatusLabel(item.currentStatus,item.gateOutAt),formatExportDuration(item.gateToDocumentSeconds),formatExportDuration(item.documentReviewSeconds),formatExportDuration(item.documentCheckedToReceivingSeconds),formatExportDuration(item.documentToReceivingSeconds),formatExportDuration(item.calledToReceivingSeconds),formatExportDuration(item.receivingSeconds),formatExportDuration(item.receivingToReturnSeconds),formatExportDuration(item.returnToGateOutSeconds),formatExportDuration(item.totalInSiteSeconds)]);
    const csv="\uFEFF"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n"),blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),link=document.createElement("a");
    link.href=url;link.download=`Warehouse_Vehicle_${month}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
    if(status)status.innerHTML=`<b>สร้างไฟล์สำเร็จ ${Number(data.total||items.length).toLocaleString("th-TH")} รายการ</b><span>${escapeHtml(data.periodLabel||month)} • ${escapeHtml(link.download)}</span>`;
    await showNotice("success",`ดาวน์โหลดข้อมูล ${items.length.toLocaleString("th-TH")} รายการแล้ว`);
  }catch(error){if(status)status.innerHTML=`<b>ส่งออกข้อมูลไม่สำเร็จ</b><span>${escapeHtml(error.message||"กรุณาลองใหม่")}</span>`;await showNotice("error",error.message||"ส่งออกข้อมูลไม่สำเร็จ")}
  finally{if(button){button.disabled=false;button.textContent=original}}
}
function csvCell(value){const text=String(value==null?"":value);return `"${text.replace(/"/g,'""')}"`}
function formatExportDuration(seconds){const value=Number(seconds);if(!Number.isFinite(value)||value<0)return "-";const total=Math.floor(value),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=total%60;return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`}
function monthlyExportStatusLabel(status,gateOutAt){if(gateOutAt)return"ออกจากพื้นที่แล้ว";return({WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",WAITING_DOCUMENT_CHECK:"รอตรวจเอกสาร",READY_FOR_RECEIVING:"พร้อมตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",WAITING_GATE_OUT:"รอออกจากพื้นที่",REJECTED_WAITING_DOCUMENT_RETURN:"ปฏิเสธรับสินค้า · รอคืนเอกสาร",REJECTED_WAITING_GATE_OUT:"ปฏิเสธรับสินค้า · รอออกจากพื้นที่",CLOSED:"ออกจากพื้นที่แล้ว"})[status]||status||"-"}

function formatStorage(bytes){const value=Math.max(0,Number(bytes)||0);if(value>=1024**3)return`${(value/1024**3).toFixed(value>=10*1024**3?0:2)} GB`;if(value>=1024**2)return`${(value/1024**2).toFixed(value>=100*1024**2?0:1)} MB`;if(value>=1024)return`${(value/1024).toFixed(1)} KB`;return`${Math.round(value)} B`}
function dataCountCard(label,value){return`<article><small>${label}</small><b>${Number(value||0).toLocaleString("th-TH")}</b></article>`}
function renderDataActivity(items){if(!items.length)return`<div class="empty-state">ยังไม่มีประวัติการทำงาน</div>`;return items.map(item=>`<div class="data-history-row"><time>${formatDate(item.event_time)}</time><span class="data-history-kind ${String(item.event_group||"").toLowerCase()}">${dataActivityLabel(item.event_code)}</span><b>${escapeHtml(item.actor||"ระบบ")}</b><span>${escapeHtml(dataActivityReference(item))}</span></div>`).join("")}
function dataActivityReference(item){const ref=String(item.reference||"").trim(),detail=String(item.detail||"").trim();return [ref,detail&&dataActivityDetail(detail)].filter(Boolean).join(" · ")||"–"}
function dataActivityDetail(value){return({COMPLETED:"สำเร็จ",RUNNING:"กำลังดำเนินการ",FAILED:"ไม่สำเร็จ",REJECTED:"ไม่รับรายการ"})[value]||value}
function dataActivityLabel(code){return({GATE_IN:"รถเข้าพื้นที่",GATE_OUT:"รถออกจากพื้นที่",DOCUMENT_SUBMITTED:"ยื่นเอกสาร",DOCUMENT_CHECKED:"ตรวจเอกสารเสร็จ",RECEIVING_STARTED:"เริ่มตรวจรับ",RECEIVING_COMPLETED:"รับสินค้าเสร็จ",RECEIVING_REJECTED:"ปฏิเสธรับสินค้า",DOCUMENT_RETURNED:"รับเอกสารคืน",ADMIN_RECEIVING_REJECTION_SETTINGS:"บันทึกตั้งค่าปฏิเสธรับสินค้า",ADMIN_USER_SAVE:"บันทึกผู้ใช้งาน",ADMIN_USER_STATUS:"เปลี่ยนสถานะผู้ใช้",ADMIN_WORKFLOW_SAVE:"บันทึกขั้นตอนงาน",ADMIN_DOORS_SAVE:"บันทึกประตู",ADMIN_SHIFTS_SAVE:"บันทึกกะ",ADMIN_ALERTS_SAVE:"บันทึกเวลาแจ้งเตือน",ADMIN_QUEUE_RECALL_SETTINGS:"บันทึกการเรียกรถซ้ำ",QUEUE_CALL_FIRST:"เรียกรถ",QUEUE_CALL_RECALL:"เรียกรถซ้ำ",QUEUE_CALL_DOOR_CHANGED:"เปลี่ยนประตูและเรียกรถ",QUEUE_NOTICE_DOCUMENT_ROOM:"เรียกติดต่อห้องเอกสาร",QUEUE_NOTICE_DOOR:"เรียกติดต่อที่ประตู",QUEUE_NOTICE_VEHICLE:"เรียกติดต่อที่รถ",SYNC_GATE:"รับข้อมูลรถ"})[code]||"อัปเดตข้อมูล"}

async function createDriverTrackingLink(){
  const input=$("trackingSearch"),button=$("trackingCreate"),resultBox=$("trackingResult");
  const search=String(input?.value||"").trim();
  if(!search){await showNotice("warning","กรุณาระบุ Auto ID หรือหมายเลขนัดหมาย");input?.focus();return}
  if(button?.disabled)return;
  const originalText=button?.textContent||"สร้างลิงก์";
  if(button){button.disabled=true;button.textContent="กำลังสร้าง"}
  try{
    const result=await api("/api/track/link",{method:"POST",body:{search}}),token=String(result?.token||"").trim();
    if(!token)throw new Error("ไม่สามารถสร้างลิงก์ติดตามได้");
    const vehicle=result.vehicle||{},url=new URL(`./track.html?t=${encodeURIComponent(token)}&v=20260811-r91`,location.href).href;
    if(resultBox){
      resultBox.hidden=false;
      resultBox.innerHTML=`<div><small>หมายเลขนัดหมาย</small><b>${escapeHtml(vehicle.appointmentNo||vehicle.autoId||search)}</b><small>${escapeHtml(joinText(vehicle.companyName,vehicle.vehiclePlate,vehicle.province))}</small></div><label><span>ลิงก์ติดตาม</span><input id="trackingGeneratedLink" value="${escapeHtml(url)}" readonly></label><div class="driver-track-actions"><button id="trackingCopyLink" class="outline-button" type="button">คัดลอกลิงก์</button><a class="primary" href="${escapeHtml(url)}" target="_blank" rel="noopener">เปิดหน้า Track</a></div>`;
      $("trackingCopyLink")?.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(url);await showNotice("success","คัดลอกลิงก์แล้ว")}catch{const link=$("trackingGeneratedLink");link?.focus();link?.select();await showNotice("info","เลือกลิงก์ไว้แล้ว สามารถคัดลอกได้")}});
    }
  }catch(error){if(resultBox)resultBox.hidden=true;await showNotice("error",error.message||"สร้างลิงก์ไม่สำเร็จ")}
  finally{if(button){button.disabled=false;button.textContent=originalText}}
}

async function adminMutation(path,body){if(adminState.busy)return;adminState.busy=true;try{Swal.fire({title:"กำลังบันทึก",allowOutsideClick:false,allowEscapeKey:false,didOpen:()=>Swal.showLoading(),showConfirmButton:false,customClass:swalClasses(),width:340});const result=await api(path,{method:"POST",body});datatableState.meta=null;adminState.data=await api("/api/admin/settings");renderAdminShell();await Swal.fire({icon:"success",title:result.message||"บันทึกแล้ว",timer:1700,showConfirmButton:false,customClass:swalClasses(),width:360})}catch(error){await showNotice("error",error.message)}finally{adminState.busy=false}}

async function logout() { try { await api("/api/auth/logout",{method:"POST"}); } catch {} clearSession(); }
function clearSession() { stopCamera();cancelDashboardRequest();dashboardState.data=null;dashboardState.dataIdentity="";dashboardState.error="";dashboardState.analyticsError="";dashboardState.analyticsLastLoadedAt=0;dashboardState.lastLoadedAt=0;dashboardState.snapshotLoaded=false; inboundLiveState.version="";inboundLiveState.checking=false;inboundLiveState.failures=0;inboundLiveState.nextAllowedAt=0;alertSoundState.initialized=false;alertSoundState.levels.clear();sessionStorage.removeItem("wvf_token"); sessionStorage.removeItem("wvf_dashboard_snapshot_r118"); state.token=""; state.user=null; state.display={dashboardEnabled:true,datatableEnabled:true}; state.appointment={moduleEnabled:false,uploadEnabled:false}; appointmentStopWorker(); appointmentUploadState.config=null;appointmentUploadState.result=null;appointmentUploadState.preview=null; $("appView").hidden=true; $("loginView").hidden=false; $("loginPassword").value=""; window.scrollTo(0, 0); }
function togglePassword() { const input=$("loginPassword"); input.type=input.type==="password"?"text":"password"; $("togglePassword").textContent=input.type==="password"?"ดู":"ซ่อน"; }

function apiDefaultTimeout(path,method){if(/archive|export|cleanup/i.test(String(path||"")))return 45000;if(/diagnostics\/(performance|resilience)|production-readiness/i.test(String(path||"")))return 30000;return method==="GET"?15000:20000}
function apiRetryDelay(attempt,response=null){const retryAfter=Number(response?.headers?.get?.("retry-after")||0);if(Number.isFinite(retryAfter)&&retryAfter>0&&retryAfter<=5)return retryAfter*1000;return Math.min(1800,350*Math.pow(2,attempt))+Math.floor(Math.random()*180)}
function apiSleep(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function api(path, options={}) {
  if (!cfg.apiBaseUrl || cfg.apiBaseUrl.includes("PUT-YOUR-WORKER")) throw new Error("ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล");
  const method=String(options.method||"GET").toUpperCase(),headers={"content-type":"application/json",...(options.headers||{})}; if (options.auth !== false && state.token) headers.authorization=`Bearer ${state.token}`;
  const timeoutMs=options.timeoutMs==null?apiDefaultTimeout(path,method):Math.max(0,Number(options.timeoutMs)||0),externalSignal=options.signal||null,maxRetries=method==="GET"&&options.retry!==false?Math.min(2,Math.max(0,Number(options.retries??1)||0)):0;
  let attempt=0,lastError=null;
  while(attempt<=maxRetries){
    const controller=timeoutMs?new AbortController():null;let signal=externalSignal||controller?.signal,timer=0;
    if(controller){signal=controller.signal;if(externalSignal){if(externalSignal.aborted)controller.abort();else externalSignal.addEventListener("abort",()=>controller.abort(),{once:true})}if(timeoutMs)timer=setTimeout(()=>controller.abort(),timeoutMs)}
    let response=null;
    try{
      response=await fetch(cfg.apiBaseUrl.replace(/\/$/,"")+path,{method,headers,body:options.body?JSON.stringify(options.body):undefined,signal});setConnection(true);if(timer)clearTimeout(timer);
      if(method==="GET"&&[429,502,503,504].includes(response.status)&&attempt<maxRetries&&!externalSignal?.aborted){await apiSleep(apiRetryDelay(attempt,response));attempt++;continue}
      const data=await response.json().catch(()=>({success:false,message:"ระบบตอบกลับไม่สมบูรณ์"}));
      if(!response.ok||data.success===false){if(response.status===401&&path!=="/api/auth/login")clearSession();if(response.status>=500)recordClientIssue(`API_${response.status}`,data.message||"ระบบตอบกลับผิดพลาด",path);const error=new Error(data.message||"ดำเนินการไม่สำเร็จ");error.status=response.status;error.data=data;throw error}
      return data
    }catch(error){
      if(timer)clearTimeout(timer);lastError=error;
      if(error?.status)throw error;
      const aborted=error?.name==="AbortError",canRetry=method==="GET"&&attempt<maxRetries&&!externalSignal?.aborted;
      if(canRetry){await apiSleep(apiRetryDelay(attempt));attempt++;continue}
      if(aborted){recordClientIssue("TIMEOUT","ระบบใช้เวลาตอบกลับนานเกินไป",path);throw new Error("ระบบใช้เวลาตอบกลับนานเกินไป กรุณาลองใหม่")}
      setConnection(false);recordClientIssue("NETWORK",error?.message||"เชื่อมต่อไม่ได้",path);throw new Error("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง")
    }
  }
  throw lastError||new Error("เชื่อมต่อระบบไม่ได้ กรุณาลองอีกครั้ง")
}

function setConnection(online) { state.online=online; $("connectionBanner").hidden=online; if($("syncStatus")) { $("syncStatus").textContent=online?"● พร้อมใช้งาน":"● รอเชื่อมต่อ"; $("syncStatus").style.color=online?"#08783a":"#a82020"; } if($("inboundSyncStatus")){ $("inboundSyncStatus").textContent=online?"● พร้อมใช้งาน":"● รอเชื่อมต่อ"; $("inboundSyncStatus").classList.toggle("is-online",online); $("inboundSyncStatus").classList.toggle("is-offline",!online);} }
function updateClocks() { const now=Math.floor(Date.now()/1000),value=formatDate(now); if($("thaiClock")) $("thaiClock").textContent=value; if($("headerClock")) $("headerClock").textContent=value; if($("inboundHeaderClock")) $("inboundHeaderClock").textContent=value; document.querySelectorAll("[data-duration-start]").forEach(element=>{const start=Number(element.dataset.durationStart);if(start>0)element.textContent=formatDuration(now-start)}) }
function formatDate(seconds) { if(!seconds)return"-"; const parts=new Intl.DateTimeFormat("en-GB",{timeZone:cfg.timezone,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).formatToParts(new Date(Number(seconds)*1000)); const p=Object.fromEntries(parts.map(x=>[x.type,x.value])); return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`; }
function formatDateShort(seconds) { if(!seconds)return"-"; const full=formatDate(seconds),parts=full.split(" "); if(parts.length<2)return full; const date=parts[0].split("/"); return `${date[0]||"--"}/${date[1]||"--"} ${parts[1]||""}`; }
function unixNow(){return Math.floor(Date.now()/1000)}
function formatDuration(seconds){const value=Math.max(0,Math.floor(Number(seconds)||0)),hours=Math.floor(value/3600),minutes=Math.floor(value%3600/60),secs=value%60;return [hours,minutes,secs].map(part=>String(part).padStart(2,"0")).join(":")}
function countStatus(status){return state.vehicles.filter(v=>v.current_status===status).length} function summary(label,value){return `<div class="summary-card"><small>${label}</small><b>${value}</b></div>`} function dashboardCard(label,value){return `<article class="dashboard-card"><small>${label}</small><b>${value}</b></article>`}
function statusLabel(status){return ({WAITING_DOCUMENT_SUBMISSION:"รอยื่นเอกสาร",DOCUMENT_SUBMITTED:"ยื่นเอกสารแล้ว",WAITING_DOCUMENT_CHECK:"รอตรวจเอกสาร",READY_FOR_RECEIVING:"พร้อมตรวจรับ",RECEIVING_IN_PROGRESS:"กำลังตรวจรับ",WAITING_DOCUMENT_RETURN:"รอรับเอกสารคืน",DOCUMENT_RETURNED:"รับเอกสารคืนแล้ว",WAITING_GATE_OUT:"รอออกจากพื้นที่",REJECTED_WAITING_DOCUMENT_RETURN:"ปฏิเสธ · รอคืนเอกสาร",REJECTED_WAITING_GATE_OUT:"ปฏิเสธ · รอออกจากพื้นที่",CLOSED:"ปิดงาน"})[status]||"กำลังดำเนินงาน"}
function statusTone(status){return ({WAITING_DOCUMENT_SUBMISSION:"tone-waiting",DOCUMENT_SUBMITTED:"tone-submitted",WAITING_DOCUMENT_CHECK:"tone-document-check",READY_FOR_RECEIVING:"tone-ready",RECEIVING_IN_PROGRESS:"tone-progress",WAITING_DOCUMENT_RETURN:"tone-return",DOCUMENT_RETURNED:"tone-returned",WAITING_GATE_OUT:"tone-gateout",REJECTED_WAITING_DOCUMENT_RETURN:"tone-rejected",REJECTED_WAITING_GATE_OUT:"tone-rejected",CLOSED:"tone-closed"})[status]||"tone-default"}
function alertLevelLabel(level){return({NORMAL:"ปกติ",WATCH:"เฝ้าระวัง",WARNING:"เตือน",URGENT:"ล่าช้า",CRITICAL:"วิกฤต"})[level]||"ปกติ"}
function alertToneClass(level){return ({NORMAL:"alert-normal",WATCH:"alert-watch",WARNING:"alert-warning",URGENT:"alert-urgent",CRITICAL:"alert-critical"})[level]||"alert-normal"}
function alertLevelRank(level){return({NORMAL:0,WATCH:1,WARNING:2,URGENT:3,CRITICAL:4})[level]??0}
function safeColor(value){return /^#[0-9A-F]{6}$/i.test(String(value||""))?String(value):"#416FC3"}
function applyVehicleData(data){const items=data.items||[];state.appointmentLive=data.appointmentLive||null;if(typeof data.trackingEnabled!=="undefined")state.trackingEnabled=Boolean(data.trackingEnabled);if(typeof data.documentCheckEnabled!=="undefined")state.documentCheckEnabled=Boolean(data.documentCheckEnabled);if(data.queueRecall&&typeof data.queueRecall==="object")state.queueRecall=data.queueRecall;if(Array.isArray(data.activeDoors))state.activeDoors=data.activeDoors.map(code=>String(code||"").trim().toUpperCase()).filter(Boolean);let shouldSound=false;if(alertSoundState.initialized){for(const vehicle of items){const key=String(vehicle.auto_id),previous=alertSoundState.levels.get(key),current=String(vehicle.alert_level||"NORMAL");if(Number(vehicle.alert_sound_enabled)&&previous&&alertLevelRank(current)>alertLevelRank(previous))shouldSound=true}}state.vehicles=items;alertSoundState.levels=new Map(items.map(vehicle=>[String(vehicle.auto_id),String(vehicle.alert_level||"NORMAL")]));if(alertSoundState.initialized&&shouldSound)playFeedbackSound("warning");alertSoundState.initialized=true}
function roleLabel(role){return ({ADMIN:"ผู้ดูแลระบบ",USER:"แผนกรับสินค้า",INBOUND:"แผนก Inbound"})[role]||role} function joinText(...parts){return parts.filter(Boolean).join(" ")||"ไม่ระบุ"} function searchable(v){return [v.auto_id,v.appointment_no,v.company_name,v.driver_name,v.vehicle_plate,v.province,v.door_code].filter(Boolean).join(" ").toLowerCase()} function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c])}
