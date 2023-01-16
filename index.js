import { fstatSync, openSync, readSync } from 'fs';

import { T, TT } from './lib/i18n.js';



export default class Biffer {
	/**
	 * sizes of format char
	 */
	static dictSize = {
		x: 1, // padding

		s: 1, // varying string
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
	 * @param {string} [locale]
	 * @returns {[Array<number|string|bigint>, number]}
	 */
	static unpack(format, buffer, start = 0, locale) {
		const startFirst = start;

		const charList = format.match(/(^[<>])|\d*[a-zA-Z]/g);

		const [endian, matchEndian] = Biffer.#parseEndian(charList);

		if(matchEndian) { charList.shift(); }

		const dataRead = [];
		charList.forEach(charRaw => {
			const [charType, count, size] = Biffer.#parseChar(charRaw);

			// varying string
			if(charType == 's') {
				dataRead.push(
					buffer.toString('utf8', start, start + count)
				);
			}
			// char
			else if(charType == 'c') {
				let remain = count;

				while(remain-- > 0) {
					dataRead.push(
						String.fromCharCode(buffer[start])
					);
				}
			}
			// integer
			else if(/[bhilq]/i.test(charType)) {
				const signed = /[bhilq]/.test(charType) ? '' : 'U';
				const big = size > 4 ? 'Big' : '';
				const sizeBytes = size * 8;
				const markEndian = size > 1 ? endian : '';


				let remain = count;
				while(remain > 0) {
					dataRead.push(
						buffer[`read${big}${signed}Int${sizeBytes}${markEndian}`](start + size * (count - remain))
					);

					remain--;
				}
			}
			// padding
			else if(charType != 'x') {
				throw TypeError(T('invalidFormatChar', { v: charType }, locale));
			}


			start += size * count;
		});

		return [dataRead, start - startFirst];
	}

	/**
	 *
	 * @param {string} format
	 * @param {string} [locale]
	 * @returns {number}
	 */
	static calc(format, locale) {
		const charList = format.match(/(^[<>])|\d*[a-zA-Z]/g);

		const [, matchEndian] = Biffer.#parseEndian(charList);

		if(matchEndian) { charList.shift(); }

		let length = 0;

		charList.forEach(charRaw => {
			const [char, count] = Biffer.#parseChar(charRaw);

			const len = Biffer.dictSize[char];

			if(!len) {
				throw TypeError(T('invalidFormatChar', { v: char }, locale));
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
	 * logger locale
	 * @type {string}
	 */
	locale;

	TT;


	/**
	 * An easy wrapper for NodeJS Buffer
	 * @param {Buffer|string|number} raw `buffer` or `file path`
	 * @param {string} [locale]
	 */
	constructor(raw, locale) {
		this.locale = locale;
		this.TT = TT(this.locale);

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
			throw TypeError(this.TT('invalidParam', { v: raw }));
		}


		this.#length = this.useFD ?
			fstatSync(this.#target).size :
			this.#target.length;
	}

	/**
	 * Unpack data according format string
	 * - `<` small endian (ONLY at the first, default endian if not set)
	 * - `>` big endian (ONLY at the first)
	 * @param {string} format
	 * @returns {Array<number|string|bigint>}
	 */
	unpack(format) {
		const sizeData = Biffer.calc(format, this.locale);

		let buffer = this.target;
		if(this.useFD) {
			readSync(this.target, buffer = Buffer.alloc(sizeData), 0, sizeData, this.pos);
		}

		const [data, byteRead] = Biffer.unpack(format, buffer, this.useFD ? 0 : this.pos, this.locale);

		this.#pos += byteRead;

		return data;
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
		if(typeof position != 'number') { throw TypeError(this.TT('invalidParam', { v: position })); }

		return this.#pos = position;
	}
	/**
	 * Offset position. negative number is valid
	 * @param {number} offset
	 * @returns {number}
	 */
	skip(offset) {
		if(typeof offset != 'number') { throw TypeError(this.TT('invalidParam', { v: offset })); }

		return this.#pos += offset;
	}

	/**
	 * Slice buffer from current position and move position
	 * @param {number} size
	 * @returns {Buffer}
	 */
	slice(size) {
		if(typeof size != 'number') { throw TypeError(this.TT('invalidParam', { v: size })); }

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
					offset = pos + offsetTemp;

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
