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

const fs = require('fs');
const path = require('path');
const Cmd = require('@ntlab/ntlib/cmd');
const Work = require('@ntlab/work/work');
const { createWorker, createScheduler } = require('tesseract.js');
const debug = require('debug')('ocr');

Cmd.addBool('help', 'h', 'Show program usage').setAccessible(false);
Cmd.addVar('config', 'c', 'Set configuration file', 'filename');
Cmd.addVar('port', 'p', 'Set server port to listen', 'port');
Cmd.addBool('test', 't', 'Perform OCR test');

if (!Cmd.parse() || (Cmd.get('help') && usage())) {
    process.exit();
}

class App {

    VERSION = 'OCR-1.0'

    config = {}
    sockets = []
    uploads = {}
    worker = 0
    extractor = {}

    initialize() {
        let filename;
        // read configuration from command line values
        filename = Cmd.get('config') ? Cmd.get('config') : path.join(__dirname, 'config.json');
        if (fs.existsSync(filename)) {
            if (!Cmd.get('test')) {
                console.log('Reading configuration %s', filename);
            }
            this.config = JSON.parse(fs.readFileSync(filename));
        }
        if (!this.config.workdir) this.config.workdir = __dirname;
        if (!this.config.imagesdir) this.config.imagesdir = path.join(this.config.workdir, 'images');
        return true;
    }

    createScheduler() {
        const works = [w => Promise.resolve(createScheduler())];
        const n = this.config.worker || 2;
        for (let i = 0; i < n; i++) {
            works.push(w => this.createWorker());
            works.push(w => Promise.resolve(w.getRes(0).addWorker(w.res)));
        }
        works.push(w => Promise.resolve(this.scheduler = w.getRes(0)));
        return Work.works(works);
    }

    createWorker(lang) {
        lang = lang || this.config.language || 'ind';
        return Work.works([
            [w => createWorker({logger: m => debug(m)})],
            [w => w.getRes(0).loadLanguage(lang)],
            [w => w.getRes(0).initialize(lang)],
            [w => Promise.resolve(console.log('Worker %d initialization finished...', ++this.worker)), w => !Cmd.get('test')],
            [w => Promise.resolve(w.getRes(0))],
        ]);
    }

    createExtrator() {
        const KtpExtractor = require('./ktp');
        this.extractor.ktp = new KtpExtractor();
    }

    createServer() {
        const { createServer } = require('http');
        const http = createServer();
        const port = Cmd.get('port') | 9000;
        const opts = {};
        if (this.config.cors) {
            opts.cors = this.config.cors;
        } else {
            opts.cors = {origin: '*'};
        }
        const { Server } = require('socket.io');
        const io = new Server(http, opts);
        io.of('/ocr')
            .on('connection', socket => {
                this.handleConnection(socket);
            })
        ;
        http.listen(port, () => {
            console.log('Application ready on port %s...', port);
        });
    }

    handleConnection(socket) {
        console.log('Client connected: %s', socket.id);
        socket
            .on('disconnect', () => {
                console.log('Client disconnected: %s', socket.id);
                const idx = this.sockets.indexOf(socket);
                if (idx >= 0) {
                    this.sockets.splice(idx);
                }
            })
            .on('setup', data => {
                socket.emit('setup', {version: this.VERSION});
            })
            .on('ocr', data => {
                // {id: string, type: string, seq: int, tot: int, size: int, len: int, data: Buffer}
                let res = {};
                if (data.id && data.type && data.data) {
                    if (this.uploads[data.id] == undefined) {
                        this.uploads[data.id] = {id: data.id};
                    }
                    let buff = Buffer.from(data.data, 'base64');
                    if (this.uploads[data.id].data != undefined) {
                        buff = Buffer.concat([this.uploads[data.id].data, buff]);
                    }
                    this.uploads[data.id].data = buff;
                    res.seq = data.seq;
                    res.tot = data.tot;
                    res.recv = buff.length;
                    if (buff.length == data.size) {
                        console.log('%s: performing OCR for %s...', socket.id, data.id)
                        Work.works([
                            [w => this.ocr(buff)],
                            [w => this.extract(data.type, w.res)],
                        ]).then(res => {
                            console.log('%s: OCR %s is completed...', socket.id, data.id)
                            socket.emit('ocr-res', {id: data.id, res: res});
                        }).catch(err => console.error(err));
                    }
                }
                socket.emit('ocr', res);
            })
        ;
    }

    save(data, filename) {
        return new Promise((resolve, reject) => {
            if (Buffer.isBuffer(data)) {
                fs.writeFile(filename, new Uint8Array(data), err => {
                    if (err) {
                        console.error('Write file %s failed with %s!', filename, err);
                        return resolve(false);
                    }
                    resolve(true);
                });
            } else {
                resolve(false);
            }
        });
    }
    
    extract(type, res) {
        if (res.data && res.data.text) {
            res = res.data.text;
        }
        if (this.extractor[type] != undefined) {
            return Promise.resolve(this.extractor[type].normalize(res));
        } else {
            return Promise.resolve(res);
        }
    }

    ocr(img) {
        return this.scheduler.addJob('recognize', img);
    }

    test() {
        let imgtest;
        if (Cmd.args.length && fs.existsSync(Cmd.args[0])) {
            imgtest = Cmd.args[0];
        } else {
            imgtest = path.join(__dirname, 'test.jpg');
        }
        return Work.works([
            [w => this.ocr(imgtest)],
            [w => this.extract('ktp', w.res)],
            [w => Promise.resolve(console.log(w.res))],
            [w => this.scheduler.terminate()],
        ]);
    }

    run() {
        if (this.initialize()) {
            this.createExtrator();
            this.createScheduler()
                .then(() => {
                    if (Cmd.get('test')) {
                        this.test();
                    } else {
                        this.createServer();
                    }
                })
                .catch(err => console.error(err));
            process.on('uncaughtExceptionMonitor', (err, origin) => {
                console.error('Got %s: %s!', origin, err);
            });
            return true;
        }
    }
}

(function run() {
    new App().run();
})();

function usage() {
    console.log('Usage:');
    console.log('  node %s [options]', path.basename(process.argv[1]));
    console.log('');
    console.log('Options:');
    console.log(Cmd.dump());
    console.log('');
    return true;
}