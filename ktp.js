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

const DataExtractor = require('./extract');

class KtpExtractor extends DataExtractor {

    props = ['provinsi', 'kabupaten', 'kota', 'nik', 'nama', 'lahir', 'kelamin', 'alamat', 'ataw', 'atrw', 'rtaw', 'rtrw', 'desa', 'kecamatan', 'agama', 'kawin', 'pekerjaan', 'warga', 'berlaku'];

    normalize(data) {
        const res = {};
        const lines = data.split('\n');
        lines.forEach(line => {
            line = this.clean(line);
            if (line) {
                const lline = line.toLowerCase();
                this.props.forEach(prop => {
                    const i = lline.indexOf(prop);
                    const p = this.pos(lline);
                    // property found as prefix or separator found after property?
                    if (i == 0 || (i > 0 && p > 0)) {
                        // property use whole line
                        if (['provinsi', 'kabupaten', 'kota'].indexOf(prop) >= 0) {
                            if (prop == 'kabupaten' || prop == 'kota') {
                                prop = 'kabko';
                            }
                        } else {
                            line = this.clean(this.pick(line));
                            // remove property from prefix
                            if (i == 0 && p == 0) {
                                line = line.substr(prop.length).trim();
                            }
                            if (['ataw', 'atrw', 'rtaw', 'rtrw'].indexOf(prop) >= 0) {
                                prop = 'rt';
                            }
                        }
                        res[prop] = line;
                        // check special property
                        if (prop == 'lahir') {
                            this.splitprop(res, line, ',', [prop, 'tgllahir']);
                        }
                        if (prop == 'kelamin') {
                            ['gol. darah', 'gol darah'].forEach(x => {
                                if (this.splitprop(res, line, x, [prop, 'goldarah'])) {
                                    return true;
                                }
                            });
                        }
                        if (prop == 'rt') {
                            if (!this.splitprop(res, line, '/', [prop, 'rw'])) {
                                if (line.length == 6) {
                                    res[prop] = line.substr(0, 3);
                                    res.rw = line.substr(3);
                                }
                            }
                        }
                    }
                });
            }
        });
        return this.fixup(res);
    }

    fixup(data) {
        return data;
    }
}

module.exports = KtpExtractor
