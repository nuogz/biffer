import { fstatSync, openSync, readFileSync, readSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import I18N from 'i18next';


export const dirPackage = dirname(fileURLToPath(import.meta.url));


const isOutputHades = (process.env.OUTPUT_FORMAT ?? '').split(';')[0]?.toLowerCase() == 'hades';
const segmentsDir = isOutputHades ? ['locale', 'hades'] : ['locale'];
const localeOutput = process.env.OUTPUT_LOCALE ?? 'en';

await I18N.init({
	lng: localeOutput,
	resources: {
		en: JSON.parse(readFileSync(resolve(dirPackage, ...segmentsDir, 'en.json'))),
		zh: JSON.parse(readFileSync(resolve(dirPackage, ...segmentsDir, 'zh.json')))
	},
});

if(isOutputHades) {
	I18N.services.formatter.add('hadesValue', value => `~{${value}}`);
	I18N.services.formatter.add('hadesTerm', value => `~[${value}]`);
}


/**
 * #### Biffer
 * - An easy wrapper for NodeJS Buffer
 * @version 1.2.0-2022.02.04.02
 * @class
 */
class Biffer {
	/**
	 * sizes of format char
	 */
	static dictSize = {
		s: 1, // vary str

		x: 1, // pad
		c: 1, // char

		b: 1, // signed char
		B: 1, // unsigned char

		h: 2, // signed short
		H: 2, // unsigned short

		i: 4, // signed int
		I: 4, // unsigned int

		l: 4, // signed long
		L: 4, // unsigned long

		q: 8, // signed long
		Q: 8, // unsigned long

		f: 4, // float
		d: 8, // double
	};

	/**
	 * @param {Array|Bufer} charList format chars
	 * @returns {string} `LE` or `BE`
	 */
	static #parseEndian(charList) {
		const char = charList[0];

		return [
			char == '>' ? 'BE' : 'LE',
			char == '>' || char == '<',
		];
	}

	static #parseChar(count_char) {
		let [count, char] = count_char.split(/(?=[A-Za-z])/);

		if(!char) {
			char = count;

			count = 1;
		}

		return [char, ~~count, Biffer.dictSize[char]];
	}

	/**
	 * @param {string} format
	 * @param {Buffer} buffer
	 * @param {number} [start=0]
	 * @returns {Array<number|string>}
	 */
	static unpack(format, buffer, start = 0) {
		const charList = format.match(/(^[<>])|\d*[a-zA-Z]/g);

		const [endian, matchEndian] = Biffer.#parseEndian(charList);

		if(matchEndian) { charList.shift(); }

		const result = [];
		charList.forEach(charRaw => {
			const [char, count, size] = Biffer.#parseChar(charRaw);

			if(char == 's') {
				result.push(
					buffer.toString('utf8', start, start + count)
				);

				start += count;
			}
			else if(char == 'c') {
				let remain = count;

				while(remain-- > 0) {
					result.push(
						String.fromCharCode(buffer[start])
					);
				}

				start += size * count;
			}
			else if(/[bhil]/i.test(char)) {
				const signed = /[bhil]/.test(char) ? '' : 'U';

				let remain = 0;

				do {
					result.push(
						buffer[`read${signed}Int${size * 8}${size > 1 ? endian : ''}`](start + size * remain)
					);
				}
				while(++remain < count);

				start += size * count;
			}
			else if(char == 'Q') {
				let remain = 0;

				do {
					const l = buffer[`readUInt32${endian}`](start + size * remain + (endian == 'LE' ? 0 : 4));
					const h = buffer[`readUInt32${endian}`](start + size * remain + (endian == 'LE' ? 4 : 0));

					result.push(
						(BigInt(h >>> 0) << BigInt(32)) | BigInt(l >>> 0)
					);
				}
				while(++remain < count);

				start += size * count;
			}
			else if(char == 'x') {
				start += size * count;
			}
			else {
				throw TypeError(I18N.t('invalidFormatChar', { v: char }));
			}
		});

		return result;
	}

	static calc(format) {
		const charList = format.match(/(^[<>])|\d*[a-zA-Z]/g);

		const [, matchEndian] = Biffer.#parseEndian(charList);

		if(matchEndian) { charList.shift(); }

		let length = 0;

		charList.forEach(charRaw => {
			const [char, count] = Biffer.#parseChar(charRaw);

			const len = Biffer.dictSize[char];

			if(!len) {
				throw TypeError(I18N.t('invalidFormatChar', { v: char }));
			}
			else {
				length += len * (~~count || 4);
			}
		});

		return length;
	}



	/**
	 * Target buffer or target file descriptor
	 * @type {Buffer|number}
	 * */
	#target;
	get target() { return this.#target; }

	/**
	 * File path (if pass file path when construct)
	 * @type {String}
	 * */
	path;

	/**
	 * Postion of used bytes
	 * @type {number}
	 * */
	#pos = 0;
	get pos() { return this.#pos; }

	/**
	 * Buffer's length
	 * @type {number}
	 * */
	#length;
	get length() { return this.#length; }

	/**
	 * use File Descriptor instead Buffer or not
	 * @type {number}
	 * */
	#useFD = false;
	get useFD() { return this.#useFD; }

	/**
	 * An easy wrapper for NodeJS Buffer
	 * @param {Buffer|string|number} raw `buffer` or `file path`
	 */
	constructor(raw) {
		if(raw instanceof Buffer) {
			this.#target = raw;
		}
		else if(typeof raw == 'number') {
			this.#target = raw;

			this.#useFD = true;
		}
		else if(typeof raw == 'string') {
			this.#target = openSync(raw);

			this.#useFD = true;

			this.path = raw;
		}
		else {
			throw TypeError(I18N.t('invalidParam', { v: raw }));
		}


		this.#length = this.useFD ?
			fstatSync(raw).size :
			this.#target.length;
	}

	/**
	 * Unpack data according format string
	 * - `<` small endian (ONLY at the first, default endian if not set)
	 * - `>` big endian (ONLY at the first)
	 * @param {string} format
	 * @returns {Array<number|string>}
	 */
	unpack(format) {
		const sizeData = Biffer.calc(format);

		let buffer = this.target;
		if(this.useFD) {
			readSync(this.target, buffer = Buffer.alloc(sizeData), 0, sizeData, this.pos);
		}

		const result = Biffer.unpack(format, buffer, this.useFD ? 0 : this.pos);

		this.#pos += sizeData;

		return result;
	}


	/**
	 * Current position
	 * @returns {number}
	 */
	tell() {
		return this.pos;
	}
	/**
	 * Set new position
	 * @param {number} position new position
	 * @returns {number}
	 */
	seek(position) {
		if(typeof position != 'number') { throw TypeError(I18N.t('invalidParam', { v: position })); }

		return this.#pos = position;
	}
	/**
	 * Offset position. negative number is valid
	 * @param {number} offset
	 * @returns {number}
	 */
	skip(offset) {
		if(typeof offset != 'number') { throw TypeError(I18N.t('invalidParam', { v: offset })); }

		return this.#pos += offset;
	}

	/**
	 * Slice buffer from current position and move position
	 * @param {number} size
	 * @returns {Buffer}
	 */
	slice(size) {
		if(typeof size != 'number') { throw TypeError(I18N.t('invalidParam', { v: size })); }

		const end = this.pos + size;

		const buffer = this.useFD ?
			Buffer.alloc(size) :
			this.target.slice(this.pos, end);

		if(this.useFD) {
			readSync(this.target, buffer, 0, size, this.pos);
		}

		this.#pos = end;

		return buffer;
	}
	/**
	 * Same for `.slice`, but wrap by new Biffer
	 * @param {number} size
	 * @returns {Biffer}
	 */
	sub(size) {
		return new Biffer(this.slice(size));
	}

	/**
	 * Returns the position of the first occurrence on buffer data
	 * @param {any} data data would pass to `Buffer.from`
	 * @returns {number} offset
	 */
	find(data) {
		const bufferData = Buffer.from(data);

		let offset = -1;

		if(this.useFD) {
			const buffer = Buffer.alloc(1024 * 1024 + bufferData.length);
			const lengthAll = this.length;
			const lengthRead = buffer.length;
			let pos = this.pos;

			while(pos < lengthAll) {
				readSync(this.target, buffer, 0, lengthRead, pos);

				const offsetTemp = buffer.indexOf(bufferData);

				if(offsetTemp > -1) {
					offset = pos + offsetTemp - this.pos;

					break;
				}

				pos += 1024 * 1024;
			}
		}
		else {
			offset = this.target.indexOf(bufferData, this.pos);
		}


		return offset > -1 ? this.#pos = offset : offset;
	}
	/**
	 * Seek to start then find data position
	 * @param {any} data data would pass to `Buffer.from`
	 * @returns {number} offset
	 */
	findFromStart(data) {
		this.seek(0);

		return this.find(data);
	}


	/**
	 * Unpack a string whose schema is `string length + string data`
	 * @param {string} format the format of string length, default is `L`
	 * @returns {string}
	 */
	unpackString(format = 'L') {
		const [length] = this.unpack(format);

		const result = this.slice(length);

		return String(result);
	}

	/**
	 * Returns the position reach the last of buffer data or not
	 * @returns {boolean}
	 */
	isEnd() {
		return this.pos >= this.length;
	}
}

Object.freeze(Biffer.dictSize);


export default Biffer;