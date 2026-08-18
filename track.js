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
const cfg=window.APP_CONFIG||{};
const $=id=>document.getElementById(id);
let timer=0,lastOk=0,inFlight=false,lastFingerprint="",hasRendered=false,terminalError=false;
let siteClockTimer=0,siteClockGateIn=0,siteClockGateOut=0,retryDelay=15000;
const TRACK_SNAPSHOT_KEY="wv_track_snapshot_r187";
const TRACK_API_MIN_VERSION=4;
function isCompatibleTrackApiVersion(value){if(!value)return true;const match=String(value).trim().match(/^20\d{2}-\d{2}-track-v(\d+)$/);return Boolean(match)&&Number(match[1])>=TRACK_API_MIN_VERSION}
const TRACK_ALERT_PREF_KEY="wv_track_alert_enabled_v1";
const TRACK_ALERT_SEEN_PREFIX="wv_track_alert_seen_v1:";
let trackAlertEnabled=readBoolStorage(TRACK_ALERT_PREF_KEY);
let trackAlertContext=null,trackAlertUnlocked=false,trackAlertPending=null,trackAlertTimers=[];
let trackAlertLastLiveKey="";

document.addEventListener("DOMContentLoaded",()=>{
  siteClockTimer=window.setInterval(updateSiteClock,1000);
  initTrackAlert();
  applyTrackDensity();
  restoreTrackSnapshot();
  loadTrack(true);
  window.addEventListener("online",()=>{if(!terminalError)loadTrack(true)});
  window.addEventListener("offline",()=>{setFresh("off","เครือข่ายขัดข้อง");schedule(30000)});
  document.addEventListener("visibilitychange",()=>{
    clearTimeout(timer);
    if(document.hidden){setFresh("wait","พักการอัปเดต");return}
    if(!terminalError)loadTrack(true);
  });
  window.addEventListener("pageshow",()=>{if(!document.hidden&&!terminalError)loadTrack(true)});
  window.addEventListener("resize",()=>requestAnimationFrame(()=>{applyTrackDensity();fitGateOutQr()}));
  window.addEventListener("orientationchange",()=>setTimeout(()=>{applyTrackDensity();fitGateOutQr()},120));
  document.addEventListener("click",event=>{
    if(event.target.closest("#trackAlertToggle")){toggleTrackAlert();return}
    if(event.target.closest("#trackOpenQr"))openGateOutQr();
    if(event.target.closest("[data-close-track-qr]"))closeGateOutQr();
    if(event.target.closest("#trackHistoryOpen"))openTrackHistory();
    if(event.target.closest("[data-close-track-history]"))closeTrackHistory();
    const qrModal=event.target.closest("#trackQrModal");
    if(qrModal&&event.target===qrModal)closeGateOutQr();
    const historyModal=event.target.closest("#trackHistoryModal");
    if(historyModal&&event.target===historyModal)closeTrackHistory();
    if(trackAlertEnabled&&!trackAlertUnlocked)unlockTrackAlert(false);
  });
  document.addEventListener("keydown",event=>{if(event.key==="Escape"){closeGateOutQr();closeTrackHistory()}});
});

function token(){return new URLSearchParams(location.search).get("t")||""}
function snapshotTokenKey(){const t=token();return t?`${t.slice(0,12)}:${t.slice(-12)}`:""}
function saveTrackSnapshot(data){
  try{sessionStorage.setItem(TRACK_SNAPSHOT_KEY,JSON.stringify({key:snapshotTokenKey(),savedAt:Date.now(),data}))}catch{}
}
function clearTrackSnapshot(){try{sessionStorage.removeItem(TRACK_SNAPSHOT_KEY)}catch{}}
function restoreTrackSnapshot(){
  try{
    const raw=sessionStorage.getItem(TRACK_SNAPSHOT_KEY);if(!raw)return false;
    const item=JSON.parse(raw);
    if(!item||item.key!==snapshotTokenKey()||!item.data?.success||Date.now()-Number(item.savedAt||0)>10*60*1000){clearTrackSnapshot();return false}
    validateTrackPayload(item.data);
    render(item.data);lastFingerprint=trackFingerprint(item.data);hasRendered=true;lastOk=Number(item.savedAt)||Date.now();
    setFresh("wait",navigator.onLine?"กำลังตรวจสอบข้อมูลล่าสุด":"แสดงข้อมูลล่าสุดที่มี");
    $("trackUpdated").textContent=`ข้อมูลล่าสุด ${new Date(lastOk).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit",second:"2-digit"})}`;
    return true;
  }catch{clearTrackSnapshot();return false}
}
function schedule(ms){clearTimeout(timer);if(document.hidden||terminalError)return;timer=setTimeout(()=>loadTrack(false),Math.max(8000,Number(ms)||20000))}

async function loadTrack(force){
  if(document.hidden||inFlight||terminalError)return;
  const t=token();
  if(!t){showTerminal("ไม่พบลิงก์ติดตาม","กรุณาสแกน QR Code จากจุดบริการ Inbound อีกครั้ง");return}
  inFlight=true;
  try{
    const controller=new AbortController();
    const cut=setTimeout(()=>controller.abort(),6000);
    const response=await fetch(`${String(cfg.apiBaseUrl||"").replace(/\/$/,"")}/api/public/track?t=${encodeURIComponent(t)}`,{cache:"no-store",signal:controller.signal,headers:{"accept":"application/json"}});
    clearTimeout(cut);
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success){
      if(data.expired||data.reason==="LINK_EXPIRED"){clearTrackSnapshot();return showTerminal("การติดตามรายการนี้สิ้นสุดแล้ว","ลิงก์หมดอายุตามระยะเวลาที่ระบบกำหนด")}
      if(data.disabled||data.reason==="TRACKING_DISABLED")return showTerminal("การติดตามถูกปิดใช้งานชั่วคราว","กรุณาติดต่อจุดบริการหากต้องการตรวจสอบสถานะ");
      if(data.reason==="INVALID_LINK"||data.reason==="TRACK_NOT_FOUND"){clearTrackSnapshot();return showTerminal("ไม่สามารถใช้ลิงก์นี้ได้",data.message||"กรุณาสแกน QR Code ใหม่จากจุดบริการ")}
      throw new Error(data.message||"ตรวจสอบสถานะไม่สำเร็จ");
    }
    validateTrackPayload(data);
    lastOk=Date.now();retryDelay=15000;saveTrackSnapshot(data);
    const fingerprint=trackFingerprint(data);
    if(force||fingerprint!==lastFingerprint||!hasRendered){render(data);lastFingerprint=fingerprint;hasRendered=true}
    handleTrackCallAlert(data);
    setFresh(data.closed?"done":"",data.closed?"เสร็จสิ้น":"ข้อมูลล่าสุด");
    $("trackUpdated").textContent=`อัปเดต ${timeText(data.generatedAt)}`;
    const suggested=Math.max(10,Math.min(60,Number(data.refreshSeconds)||20));
    const seconds=data.vehicle?.status==="READY_FOR_RECEIVING"?Math.min(10,suggested):suggested;
    schedule(seconds*1000);
  }catch(error){
    const online=navigator.onLine;
    if(hasRendered||lastOk){
      const age=lastOk?Math.max(0,Math.floor((Date.now()-lastOk)/1000)):0;
      setFresh("wait",online?(age>60?`ข้อมูลล่าสุด ${Math.floor(age/60)} นาทีที่แล้ว`:"รออัปเดตข้อมูล"):"เครือข่ายขัดข้อง");
      schedule(online?retryDelay:30000);
      if(online)retryDelay=Math.min(60000,retryDelay*2);
    }else{showRetry(error.name==="AbortError"?"การเชื่อมต่อใช้เวลานานเกินไป":error.message);schedule(retryDelay);retryDelay=Math.min(60000,retryDelay*2)}
  }finally{inFlight=false}
}

function trackFingerprint(data){return JSON.stringify({v:data?.vehicle,t:data?.timeline,q:data?.queueCall,h:data?.callHistory,n:data?.queueNotice,nh:data?.noticeHistory,r:data?.rejection,closed:data?.closed,expiresAt:data?.expiresAt,instruction:data?.instruction,lifecycle:data?.lifecycle,stateUpdatedAt:data?.stateUpdatedAt||0})}
function recentQueueNotice(data,maxAgeSeconds=900){
  const notice=data?.queueNotice;if(!notice?.noticeId||!Number(notice.notifiedAt||0))return null;
  return Math.max(0,Math.floor(Date.now()/1000)-Number(notice.notifiedAt))<=maxAgeSeconds?notice:null;
}
function validateTrackPayload(data){
  if(!isCompatibleTrackApiVersion(data?.apiVersion))throw new Error("รูปแบบข้อมูลติดตามไม่รองรับ กรุณาเปิดหน้าใหม่");
  const v=data?.vehicle;
  if(!v||!v.autoId||!Number(v.gateInAt)||!Array.isArray(data.timeline))throw new Error("ข้อมูลติดตามไม่ครบถ้วน กรุณาลองใหม่");
  if(v.status==="CLOSED"&&!data.closed)throw new Error("สถานะการติดตามยังไม่สอดคล้อง กรุณาลองใหม่");
  const generatedAt=Number(data.generatedAt||0),now=Math.floor(Date.now()/1000);
  if(generatedAt&&now-generatedAt>120)throw new Error("ข้อมูลที่ได้รับเก่าเกินไป กรุณาลองใหม่");
}

function render(data){
  const v=data.vehicle||{},steps=data.timeline||[],q=data.queueCall||{called:false,callCount:0},history=Array.isArray(data.callHistory)?data.callHistory:[],rejection=data.rejection||null;
  const currentIndex=currentStepIndex(steps,v.status,q);
  const instruction=String(data.instruction||instructionFor(v.status,v.doorCode,q));
  const expiry=data.expiresAt?dateText(data.expiresAt):"-";
  const gateOut=v.gateOutAt?dateText(v.gateOutAt):"";
  const returned=steps.some(step=>step.code==="DOCUMENT_RETURNED"&&step.done),rejectedExit=v.status==="REJECTED_WAITING_GATE_OUT";
  const showGateOutQr=((v.status==="WAITING_GATE_OUT"&&returned)||rejectedExit)&&!v.gateOutAt&&Boolean(v.autoId);
  const autoId=String(v.autoId||"");
  const qrSvg=showGateOutQr&&window.WVQRCode?.toSvg?window.WVQRCode.toSvg(autoId,{margin:4}):"";
  const calledToDoor=!rejection&&v.status==="READY_FOR_RECEIVING"&&q.called&&q.doorCode,notice=rejection?null:recentQueueNotice(data);
  const mainInstruction=notice?.label||(calledToDoor?`กรุณานำรถเข้าประตู ${q.doorCode}`:instruction);
  const workflowAfterNotice=notice?(calledToDoor?`เข้าตรวจรับสินค้าที่ประตู ${q.doorCode}`:instruction):"";
  const instructionNote=notice?`ข้อความจากเจ้าหน้าที่ · ${timeText(notice.notifiedAt)}`:(calledToDoor?instruction:"");
  const statusPillText=notice?"มีข้อความจากเจ้าหน้าที่":(v.statusLabel||"กำลังดำเนินการ");
  siteClockGateIn=Number(v.gateInAt||0);
  siteClockGateOut=Number(v.gateOutAt||0);
  $("trackMain").innerHTML=`<article class="track-card">
    <section class="track-identity">
      <header><div><small>เลขนัดหมาย</small><strong>${esc(v.appointmentNo||"-")}</strong></div><span class="track-status-pill ${rejection?"rejected":notice?"officer":data.closed?"closed":q.called&&v.status==="READY_FOR_RECEIVING"?"called":""}">${esc(statusPillText)}</span></header>
      <div class="track-identity-grid"><div><small>บริษัท</small><b>${esc(v.companyName||"ไม่ระบุบริษัท")}</b></div><div><small>ทะเบียนรถ</small><b>${esc(v.vehiclePlate||"ไม่ระบุ")}</b></div><div><small>จังหวัด</small><b>${esc(v.province||"ไม่ระบุ")}</b></div>${v.driverName?`<div><small>คนขับรถ</small><b>${esc(v.driverName)}</b></div>`:""}</div>
    </section>
    <section class="track-instruction ${rejection?"rejected":notice?"officer-notice":q.called&&v.status==="READY_FOR_RECEIVING"?"called":""} ${["WAITING_GATE_OUT","REJECTED_WAITING_GATE_OUT"].includes(v.status)?"exit-ready":""}">
      <div class="track-instruction-mark" aria-hidden="true">${rejection?"!":notice?"!":q.called&&v.status==="READY_FOR_RECEIVING"?"→":["WAITING_GATE_OUT","REJECTED_WAITING_GATE_OUT"].includes(v.status)?"QR":"i"}</div>
      <div class="track-instruction-copy"><small>สิ่งที่ต้องทำตอนนี้</small><b>${esc(mainInstruction)}</b>${instructionNote?`<span class="track-instruction-source">${esc(instructionNote)}</span>`:""}${notice&&workflowAfterNotice?`<div class="track-followup"><small>งานหลักหลังจากนั้น</small><strong>${esc(workflowAfterNotice)}</strong></div>`:""}</div>
    </section>
    ${rejection?renderRejectionStatus(rejection):renderQueueStatus(q,v.status)}
    ${!rejection&&history.length?renderCallHistory(history):""}
    <section class="track-timeline"><header><h2>ขั้นตอนการดำเนินงาน</h2><span>อัปเดตอัตโนมัติ</span></header><div class="track-timeline-steps">${steps.map((step,index)=>`<div class="track-step ${step.done?"done":""} ${index===currentIndex?"current":""}" data-step-index="${index}"><i aria-hidden="true"></i><b>${esc(step.label)}</b><span>${step.at?timeText(step.at):"รอดำเนินการ"}</span></div>`).join("")}</div></section>
    <section class="track-site-time"><div><small>เข้าพื้นที่</small><b>${esc(v.gateInAt?dateText(v.gateInAt):"-")}</b></div><div><small>${data.closed?"เวลารวมทั้งหมด":"อยู่ในพื้นที่แล้ว"}</small><b id="trackSiteDuration">${formatDuration(siteElapsedSeconds())}</b></div></section>
    ${showGateOutQr?`<section class="track-exit-action"><div><small>พร้อมสำหรับขั้นตอนออกจากพื้นที่</small><b>เปิด QR เฉพาะเมื่อต้องใช้ที่จุดออกจากพื้นที่</b></div><button id="trackOpenQr" type="button">เปิด QR สำหรับออกจากพื้นที่</button></section>
    <div id="trackQrModal" class="track-qr-modal" hidden><section class="track-qr-sheet" role="dialog" aria-modal="true" aria-labelledby="trackQrTitle"><header><div><small>QR Code สำหรับออกจากพื้นที่</small><h2 id="trackQrTitle">แสดงต่อเจ้าหน้าที่หรือเครื่องสแกน</h2></div><button type="button" data-close-track-qr aria-label="ปิด QR">×</button></header><div class="gateout-qr-code">${qrSvg}</div><div class="gateout-qr-copy"><b>ใช้ Auto ID เดียวกับ QR ขาเข้า (Gate In)</b><span>เมื่อใช้งานเสร็จสามารถปิดหน้าต่างนี้เพื่อกลับไปดูสถานะรถ</span></div><div class="gateout-autoid"><small>Auto ID</small><strong>${esc(autoId)}</strong></div><button class="track-qr-close" type="button" data-close-track-qr>ปิด QR</button></section></div>`:""}
    ${data.closed&&gateOut?`<section class="track-complete"><small>ออกจากพื้นที่</small><b>${esc(gateOut)}</b></section>`:""}
    <section class="track-expiry"><span>${data.closed?"ตรวจสอบย้อนหลังได้ถึง":"ติดตามได้ถึง"}</span><b>${esc(expiry)}</b></section>
  </article>`;
  updateSiteClock();
}

function renderRejectionStatus(rejection){
  if(!rejection)return"";const reason=String(rejection.reason||"ไม่ระบุเหตุผล"),next=rejection.requireDocumentReturn?"รอรับเอกสารคืน":"รอออกจากพื้นที่";
  return `<section class="track-rejection-status"><div><small>ผลการรับสินค้า</small><b>ปฏิเสธรับสินค้า</b></div><div><small>เหตุผล</small><strong>${esc(reason)}</strong></div><div><small>ขั้นตอนถัดไป</small><strong>${esc(next)}</strong></div></section>`;
}
function renderQueueStatus(q,status){
  const called=Boolean(q?.called),latestLabel=called?(q.statusLabel||queueCallTypeLabel(q.callType)):"ยังไม่เรียก";
  const door=called&&q.doorCode?q.doorCode:called?"ยังไม่ระบุ":"–",latest=called&&q.calledAt?timeText(q.calledAt):"–",count=Math.max(0,Number(q.callCount||0));
  const helper=!called&&status==="READY_FOR_RECEIVING"?"กรุณารอการเรียกเข้าตรวจรับสินค้า":called&&q.callType==="DOOR_CHANGED"&&q.previousDoorCode&&q.doorCode?`เปลี่ยนจาก ${q.previousDoorCode} เป็น ${q.doorCode}`:called?"ตรวจสอบประตูปัจจุบันก่อนเคลื่อนรถทุกครั้ง":"ยังไม่มีข้อมูลการเรียก";
  return `<section class="track-call-status"><header><div><h2>สถานะการเรียก</h2></div></header><div class="track-call-metrics"><div class="metric-status"><small>สถานะล่าสุด</small><b class="metric-call">${esc(latestLabel)}</b></div><div class="metric-door"><small>ประตูปัจจุบัน</small><b>${esc(door)}</b></div><div class="metric-count"><small>จำนวนครั้งที่เรียก</small><b>${count.toLocaleString("th-TH")} ครั้ง</b></div><div class="metric-time"><small>เวลาที่เรียกล่าสุด</small><b>${esc(latest)}</b></div></div><div class="track-call-helper">${esc(helper)}</div></section>`;
}
function renderCallHistory(history){
  const latest=history[0];if(!latest)return"";
  const label=latest.callTypeLabel||queueCallTypeLabel(latest.callType);
  const door=latest.callType==="DOOR_CHANGED"&&latest.previousDoorCode&&latest.doorCode?`${latest.previousDoorCode} → ${latest.doorCode}`:(latest.doorCode||"ไม่ระบุประตู");
  const row=`<div class="track-history-row compact"><time>${esc(latest.calledAt?timeText(latest.calledAt):"-")}</time><b>${esc(label)}</b><span>${esc(door)}</span><small>${esc(latest.calledAt?shortDateText(latest.calledAt):"-")}</small></div>`;
  const allRows=history.slice(0,5).map(item=>{
    const itemLabel=item.callTypeLabel||queueCallTypeLabel(item.callType);
    const itemDoor=item.callType==="DOOR_CHANGED"&&item.previousDoorCode&&item.doorCode?`${item.previousDoorCode} → ${item.doorCode}`:(item.doorCode||"ไม่ระบุประตู");
    return `<div class="track-history-row"><time>${esc(item.calledAt?timeText(item.calledAt):"-")}</time><b>${esc(itemLabel)}</b><span>${esc(itemDoor)}</span><small>${esc(item.calledAt?shortDateText(item.calledAt):"-")}</small></div>`;
  }).join("");
  return `<section class="track-call-history"><header><h2>การเรียกล่าสุด</h2><button id="trackHistoryOpen" type="button">ดูทั้งหมด ${history.length>1?`(${history.length})`:""}</button></header>${row}</section>
  <div id="trackHistoryModal" class="track-history-modal" hidden><section class="track-history-sheet" role="dialog" aria-modal="true" aria-labelledby="trackHistoryTitle"><header><div><small>ข้อมูลการเรียกรถ</small><h2 id="trackHistoryTitle">ประวัติการเรียกล่าสุด</h2></div><button type="button" data-close-track-history aria-label="ปิดประวัติ">×</button></header><div class="track-history-list">${allRows}</div><button class="track-history-close" type="button" data-close-track-history>ปิด</button></section></div>`;
}
function queueCallTypeLabel(type){return({FIRST:"เรียกครั้งแรก",RECALL:"เรียกซ้ำ",DOOR_CHANGED:"เปลี่ยนประตู"})[String(type||"").toUpperCase()]||"เรียกเข้าตรวจรับ"}

function openTrackHistory(){const modal=$("trackHistoryModal");if(!modal)return;modal.hidden=false;document.body.classList.add("track-modal-open");modal.querySelector("[data-close-track-history]")?.focus()}
function closeTrackHistory(){const modal=$("trackHistoryModal");if(!modal||modal.hidden)return;modal.hidden=true;document.body.classList.remove("track-modal-open");$("trackHistoryOpen")?.focus()}

function readBoolStorage(key){try{return localStorage.getItem(key)==="1"}catch{return false}}
function writeBoolStorage(key,value){try{localStorage.setItem(key,value?"1":"0")}catch{}}
function alertSeenStorageKey(){return TRACK_ALERT_SEEN_PREFIX+snapshotTokenKey()}
function readSeenAlertKey(){try{return sessionStorage.getItem(alertSeenStorageKey())||""}catch{return""}}
function writeSeenAlertKey(value){try{sessionStorage.setItem(alertSeenStorageKey(),String(value||""))}catch{}}
function currentTrackCallKey(data){
  const rejection=data?.rejection;if(rejection?.rejectedAt)return`rejection:${rejection.rejectedAt}`;
  const notice=recentQueueNotice(data);if(notice)return`notice:${notice.noticeId}`;
  const q=data?.queueCall||{},latest=Array.isArray(data?.callHistory)?data.callHistory[0]:null;
  if(!q.called)return"";
  return String(latest?.callId||[q.callType||"CALL",q.calledAt||0,q.doorCode||"",q.callCount||0].join(":"));
}
function initTrackAlert(){updateTrackAlertButton();document.documentElement.dataset.trackDensity="normal"}
function applyTrackDensity(){
  const h=window.innerHeight||700,w=window.innerWidth||390;
  let density="normal";
  // Prioritize legibility on phones. Short portrait screens may scroll rather than shrinking text to unreadable sizes.
  if(w<=760&&h<=720)density="compact";else if(w<=760)density="mobile";
  document.documentElement.dataset.trackDensity=density;
}
async function toggleTrackAlert(){
  if(trackAlertEnabled&&!trackAlertUnlocked){
    updateTrackAlertButton("กำลังเปิด...");const ok=await unlockTrackAlert(true);updateTrackAlertButton();if(ok&&trackAlertPending)playTrackCallAlert(trackAlertPending);return;
  }
  if(trackAlertEnabled){
    trackAlertEnabled=false;writeBoolStorage(TRACK_ALERT_PREF_KEY,false);clearTrackAlertTimers();trackAlertPending=null;try{navigator.vibrate?.(0)}catch{};updateTrackAlertButton();return;
  }
  trackAlertEnabled=true;writeBoolStorage(TRACK_ALERT_PREF_KEY,true);updateTrackAlertButton("กำลังเปิด...");
  const ok=await unlockTrackAlert(true);updateTrackAlertButton();
  if(ok&&trackAlertPending)playTrackCallAlert(trackAlertPending);
}
async function unlockTrackAlert(fromGesture){
  try{
    const AudioCtx=window.AudioContext||window.webkitAudioContext;if(!AudioCtx)return false;
    if(!trackAlertContext)trackAlertContext=new AudioCtx();
    if(trackAlertContext.state!=="running")await trackAlertContext.resume();
    trackAlertUnlocked=trackAlertContext.state==="running";
    if(trackAlertUnlocked&&fromGesture)playTone(520,0.055,0.035);
    updateTrackAlertButton();return trackAlertUnlocked;
  }catch{trackAlertUnlocked=false;updateTrackAlertButton();return false}
}
function updateTrackAlertButton(forcedLabel=""){
  const btn=$("trackAlertToggle"),label=$("trackAlertLabel");if(!btn||!label)return;
  btn.setAttribute("aria-pressed",trackAlertEnabled?"true":"false");
  btn.classList.toggle("is-on",trackAlertEnabled);btn.classList.toggle("needs-tap",trackAlertEnabled&&!trackAlertUnlocked&&Boolean(trackAlertPending));
  label.textContent=forcedLabel||(trackAlertEnabled?(trackAlertUnlocked?"เสียงเตือนเปิด":trackAlertPending?"แตะเปิดเสียง":"เสียงเตือน"):(trackAlertPending?"เปิดเสียงเตือน":"เสียงเตือน"));
}
function handleTrackCallAlert(data){
  const q=data?.queueCall||{},v=data?.vehicle||{},rejection=data?.rejection||null,notice=rejection?null:recentQueueNotice(data);
  if(!rejection&&!notice&&(v.status!=="READY_FOR_RECEIVING"||!q.called)){trackAlertPending=null;updateTrackAlertButton();return}
  const key=currentTrackCallKey(data);if(!key||key===trackAlertLastLiveKey&&key===readSeenAlertKey())return;
  trackAlertLastLiveKey=key;if(readSeenAlertKey()===key)return;
  trackAlertPending=rejection?{key,callType:"REJECTION",doorCode:"",callCount:1,calledAt:Number(rejection.rejectedAt||0)}:notice?{key,callType:String(notice.noticeType||"NOTICE"),doorCode:String(notice.doorCode||""),callCount:1,calledAt:Number(notice.notifiedAt||0)}:{key,callType:String(q.callType||"FIRST"),doorCode:String(q.doorCode||""),callCount:Number(q.callCount||1),calledAt:Number(q.calledAt||0)};
  const instruction=document.querySelector(".track-instruction");if(instruction){instruction.classList.remove("alerting");void instruction.offsetWidth;instruction.classList.add("alerting");setTimeout(()=>instruction.classList.remove("alerting"),9000)}
  updateTrackAlertButton();
  if(trackAlertEnabled&&trackAlertUnlocked)playTrackCallAlert(trackAlertPending);
}
function clearTrackAlertTimers(){for(const id of trackAlertTimers)clearTimeout(id);trackAlertTimers=[]}
function playTrackCallAlert(alert){
  if(!alert||!trackAlertEnabled||!trackAlertUnlocked||!trackAlertContext||trackAlertContext.state!=="running")return false;
  clearTrackAlertTimers();
  const type=String(alert.callType||"FIRST").toUpperCase();
  const pattern=type==="REJECTION"?[[0,520],[260,420],[520,520],[900,420]]:type.startsWith("NOTICE_")?[[0,740],[180,980],[360,1220],[650,980],[830,1220]]:type==="DOOR_CHANGED"?[[0,720],[260,1080],[650,720],[910,1080]]:type==="RECALL"?[[0,980],[210,980],[420,980],[760,1180]]:[[0,860],[300,1040],[600,1180]];
  for(let cycle=0;cycle<3;cycle++){
    const base=cycle*2600;
    for(const [offset,freq] of pattern)trackAlertTimers.push(setTimeout(()=>playTone(freq,.15,.18),base+offset));
  }
  try{navigator.vibrate?.(type==="DOOR_CHANGED"?[450,180,450,350,700,1200,450,180,450]:type==="RECALL"?[300,150,300,150,500,1000,300,150,500]:[450,220,450,220,650])}catch{}
  writeSeenAlertKey(alert.key);trackAlertPending=null;updateTrackAlertButton();return true;
}
function playTone(freq,duration=0.14,volume=0.16){
  try{
    const ctx=trackAlertContext;if(!ctx||ctx.state!=="running")return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    osc.type="sine";osc.frequency.setValueAtTime(Math.max(180,Number(freq)||880),now);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.02,Math.min(.3,volume)),now+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+Math.max(.05,duration));
    osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+Math.max(.06,duration)+.03);
  }catch{}
}

function openGateOutQr(){
  const modal=$("trackQrModal");if(!modal)return;
  modal.hidden=false;document.body.classList.add("track-modal-open");
  requestAnimationFrame(()=>{fitGateOutQr();modal.querySelector("[data-close-track-qr]")?.focus()});
}
function closeGateOutQr(){const modal=$("trackQrModal");if(!modal||modal.hidden)return;modal.hidden=true;document.body.classList.remove("track-modal-open");$("trackOpenQr")?.focus()}
function fitGateOutQr(){
  const modal=$("trackQrModal");const qr=modal?.querySelector(".gateout-qr-code");if(!modal||modal.hidden||!qr)return;
  const size=Math.floor(Math.min((window.innerWidth||360)*.78,(window.innerHeight||700)*.48,420));
  qr.style.width=`${Math.max(190,size)}px`;qr.style.height=`${Math.max(190,size)}px`;
}

function siteElapsedSeconds(){
  if(!siteClockGateIn)return 0;
  const end=siteClockGateOut||Math.floor(Date.now()/1000);
  return Math.max(0,end-siteClockGateIn);
}
function formatDuration(total){
  total=Math.max(0,Math.floor(Number(total)||0));
  const days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
  const clock=[hours,minutes,seconds].map(v=>String(v).padStart(2,"0")).join(":");
  return days?`${days} วัน ${clock}`:clock;
}
function updateSiteClock(){const el=$("trackSiteDuration");if(el)el.textContent=formatDuration(siteElapsedSeconds())}

function instructionFor(status,door,q={}){
  if(status==="WAITING_DOCUMENT_SUBMISSION")return"กรุณายื่นเอกสารที่จุดบริการ";
  if(status==="WAITING_DOCUMENT_CHECK")return"ยื่นเอกสารแล้ว กรุณารอเจ้าหน้าที่ตรวจเอกสาร";
  if(status==="READY_FOR_RECEIVING")return q.called?(door?`กรุณานำรถเข้าประตู ${door}`:"มีการเรียกเข้าตรวจรับสินค้าแล้ว"):"ตรวจเอกสารเรียบร้อยแล้ว กรุณารอการเรียกเข้าตรวจรับสินค้า";
  if(status==="RECEIVING_IN_PROGRESS")return door?`กรุณาดำเนินการตรวจรับสินค้าที่ประตู ${door}`:"กำลังตรวจรับสินค้า";
  if(status==="WAITING_DOCUMENT_RETURN")return"กรุณารอรับเอกสารคืน";
  if(status==="WAITING_GATE_OUT")return"รับเอกสารคืนแล้ว กรุณาเปิด QR เมื่อต้องการใช้สำหรับออกจากพื้นที่";
  if(status==="REJECTED_WAITING_DOCUMENT_RETURN")return"การรับสินค้าถูกปฏิเสธ กรุณารอรับเอกสารคืน";
  if(status==="REJECTED_WAITING_GATE_OUT")return"การรับสินค้าถูกปฏิเสธ กรุณาดำเนินการออกจากพื้นที่";
  if(status==="CLOSED")return"รายการเสร็จสิ้นแล้ว";
  return"กรุณาตรวจสอบสถานะบนหน้านี้";
}
function currentStepIndex(steps,status,q={}){
  const code=status==="WAITING_DOCUMENT_SUBMISSION"?"DOCUMENT_SUBMITTED":status==="WAITING_DOCUMENT_CHECK"?"DOCUMENT_CHECKED":status==="READY_FOR_RECEIVING"?"QUEUE_CALLED":status==="RECEIVING_IN_PROGRESS"?"RECEIVING_STARTED":status==="WAITING_DOCUMENT_RETURN"?"RECEIVING_COMPLETED":status==="WAITING_GATE_OUT"?"DOCUMENT_RETURNED":status==="REJECTED_WAITING_DOCUMENT_RETURN"||status==="REJECTED_WAITING_GATE_OUT"?"RECEIVING_REJECTED":status==="CLOSED"?"GATE_OUT":"GATE_IN";
  const idx=steps.findIndex(step=>step.code===code);return idx>=0?idx:Math.max(0,steps.length-1);
}
function showRetry(message){$("trackMain").innerHTML=`<div class="track-error"><b>ยังไม่สามารถอัปเดตสถานะได้</b><span>${esc(message)}</span><button id="trackRetry" type="button">ลองใหม่</button></div>`;$("trackRetry")?.addEventListener("click",()=>loadTrack(true));setFresh("off","ตรวจสอบไม่สำเร็จ")}
function showTerminal(title,message){terminalError=true;clearTimeout(timer);$("trackMain").innerHTML=`<div class="track-terminal"><div class="terminal-mark" aria-hidden="true"></div><b>${esc(title)}</b><span>${esc(message)}</span><small>ข้อมูลการปฏิบัติงานหลักไม่ได้รับผลกระทบ</small></div>`;setFresh("off","สิ้นสุดการติดตาม")}
function setFresh(cls,text){const el=$("trackFresh");el.className=`track-fresh ${cls||""}`;el.textContent=text}
function dateText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function shortDateText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",day:"2-digit",month:"short",year:"numeric"}).format(new Date(Number(ts)*1000))}
function timeText(ts){if(!ts)return"-";return new Intl.DateTimeFormat("th-TH",{timeZone:"Asia/Bangkok",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false}).format(new Date(Number(ts)*1000))}
function esc(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
