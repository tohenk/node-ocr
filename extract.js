/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2023 Toha <tohenk@yahoo.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
 * of the Software, and to permit persons to whom the Software is furnished to do
 * so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

class DataExtractor {

    delimiter = [':', '-', '—'] 
    removes = ['-', '—', '|', '.', ':']

    normalize(data) {
        return data;
    }

    pos(s) {
        let pos = 0;
        this.delimiter.forEach(sep => {
            let p = s.indexOf(sep);
            if (p > 0 && (p < pos || pos == 0)) {
                pos = p;
            } 
        });
        return pos;
    }

    pick(s) {
        let pos = this.pos(s);
        return pos > 0 ? s.substr(pos + 1).trim() : s;
    }

    splitprop(res, s, separator, props) {
        let a = this.split(s, separator);
        if (a.length == 2) {
            res[props[0]] = a[0];
            res[props[1]] = a[1];
            return true;
        }
    }

    split(s, separator) {
        const res = [];
        const p = s.toLowerCase().indexOf(separator);
        if (p > 0) {
            res.push(this.clean(s.substr(0, p)));
            res.push(this.clean(s.substr(p + separator.length)));
        }
        return res;
    }

    clean(s) {
        if (s) {
            s = s.trim();
            let next = false;
            while (true) {
                let c = next ? s.substr(-1) : s.substr(0, 1);
                if (this.removes.indexOf(c) < 0) {
                    if (next) {
                        break;
                    } else {
                        next = true;
                        continue;
                    }
                }
                if (next) {
                    s = s.substr(0, s.length - 1).trim();
                } else {
                    s = s.substr(1).trim();
                }
            }
        }
        return s;
    }
}

module.exports = DataExtractor
