export default class Biffer {
    /**
     * sizes of format char
     */
    static dictSize: {
        x: number;
        s: number;
        c: number;
        b: number;
        B: number;
        h: number;
        H: number;
        i: number;
        I: number;
        l: number;
        L: number;
        q: number;
        Q: number;
        f: number;
        d: number;
    };
    /**
     * @param {string[]} chars format chars
     * @returns {['LE' | 'BE', boolean]} `LE` or `BE`
     */
    static "__#1@#parseEndian"(chars: string[]): ['LE' | 'BE', boolean];
    /**
     * @param {string} count_char
     * @returns {[string, number, number]}
     */
    static "__#1@#parseChar"(count_char: string): [string, number, number];
    /**
     * @param {string} format
     * @param {Buffer} buffer
     * @param {number} [start=0]
     * @returns {[(number|bigint|string)[], number]}
     */
    static unpack(format: string, buffer: Buffer, start?: number): [(number | bigint | string)[], number];
    /**
     *
     * @param {string} format
     * @returns {number}
     */
    static calc(format: string): number;
    /**
     * An easy wrapper for NodeJS Buffer
     * @param {Buffer|string|number} raw `buffer` or `file path`
     */
    constructor(raw: Buffer | string | number);
    get target(): any;
    /**
     * File path (if pass file path when construct)
     * @type {String}
     * */
    path: string;
    get pos(): number;
    get length(): number;
    get useFD(): number;
    /**
     * Unpack data according format string
     * - `<` small endian (ONLY at the first, default endian if not set)
     * - `>` big endian (ONLY at the first)
     * @param {string} format
     * @returns {(number|bigint|string)[]}
     */
    unpack(format: string): (number | bigint | string)[];
    /**
     * Current position
     * @returns {number}
     */
    tell(): number;
    /**
     * Set new position
     * @param {number} position new position
     * @returns {number}
     */
    seek(position: number): number;
    /**
     * Offset position. negative number is valid
     * @param {number} offset
     * @returns {number}
     */
    skip(offset: number): number;
    /**
     * Slice buffer from current position and move position
     * @param {number} size
     * @returns {Buffer}
     */
    slice(size: number): Buffer;
    /**
     * Same for `.slice`, but wrap by new Biffer
     * @param {number} size
     * @returns {Biffer}
     */
    sub(size: number): Biffer;
    /**
     * Returns the position of the first occurrence on buffer data
     * @param {any} data data would pass to `Buffer.from`
     * @returns {number} offset
     */
    find(data: any): number;
    /**
     * Seek to start then find data position
     * @param {any} data data would pass to `Buffer.from`
     * @returns {number} offset
     */
    findFromStart(data: any): number;
    /**
     * Unpack a string whose schema is `string length + string data`
     * @param {string} format the format of string length, default is `L`
     * @returns {string}
     */
    unpackString(format?: string): string;
    /**
     * Returns the position reach the last of buffer data or not
     * @returns {boolean}
     */
    isEnd(): boolean;
    #private;
}
