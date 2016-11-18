var path = require('path');
var fs = require('fs');
var bs = require('browser-sync');
var colors = require('colors');

var Compress = require('./compress');
var genPort = require('./genPort');
var Server = require('./server');

var defaults = {
    listenPath: '/+(css|js|html|widget|test)/**',
    host: 'localhost',
    port: 80,
    devPath: ''
};

// config template
// var config = {
//     autoOpenurl:''
//     comboDebug:''
//     type:'',
//     jdfconfig: '',
//     serverDir: jdf.bgCurrentDir
//     buildDir: jdf.getProjectPath();
//     currentDir
// }
// TODO 测试 写两个watch会怎么样
// 
var server = module.exports;
server.NAME = 'bsServer';

// 私有变量管理watch列表
var watchlist = [];

/**
 * 启动本地服务器
 * @param  {json}     config   必要参数集合
 * @param  {function} callback 启动成功后回调函数
 */
server.startup = function (config, callback) {
    defaults.devPath = config.currentDir;
    // if config == funtion, callback = config; 然而需要提供默认config，实际上不现实
    genPort.findUsablePort(config.jdfconfig.localServerPort)
    .then(function (port) {
        // server.init 启动本地服务器
        config.jdfconfig.localServerPort = port;
        Server.init(config.serverDir, 
            port, // 被代理服务器隐藏端口号
            config.jdfconfig.cdn, 
            config.buildDir, 
            config.comboDebug, 
            Compress.addJsDepends);

        return port;
    }, function () {
        console.log('no port available!');
    })
    .then(function (port) {
        // bs.create.init and open url
        var indexPath = '';
        if (config.autoOpenurl) {
            if (fs.existsSync(path.normalize(config.bgCurrentDir + '/html/index.html'))) {
                indexPath = 'html/index.html';
            } else {
                indexPath = 'html/';
            }
        }
        var options = {
            proxy: 'localhost:' + port,
            open: config.autoOpenurl,
            index: indexPath
        }
        return initBSServer(server.NAME, options);
    })
    .then(function (options) {
        if(callback) {
            callback(config.jdfconfig.localServerPort);
        }
        console.log(`jdf server running at http://${options.proxy},`);
        console.log(`be proxied by browserSync at port ${colors.cyan(3000)}`);
    })
    .catch(function (err) {
        console.log(err);
    })
}

// 多种watch实现用options比较好
server.watch = function (options, cb) {
    if (typeof options === 'function') {
        cb = options;
        options = {};
        options.listenPath = defaults.listenPath;
    }
    var bsServer = server.getServer(server.NAME);

    var listenPath = defaults.devPath + '/' + options.listenPath; 
    listenPath = path.normalize(listenPath);
    bsServer.watch(listenPath, function (event, filename) {
        if (!(event === 'add' || event === 'addDir')) {
            cb(event, filename, bsServer.reload);
        } 
    });
}

server.getServer = function (name) {
    return bs.get(name);
}

// 监控信息
server.isActive = function () {
    try {
        if (bs.get(server.NAME)) {
            return bs.get(server.NAME).active;
        }
    } catch (e) {
        console.log('No browserSync Server!');
    }
    return false;
};

/**
 * create or get a browser-sync server, then init it
 * @param  {string}   name    server name
 * @param  {json}     options bs server init options
 * @param  {Function} cb      callback after init bs server
 */
function initBSServer(name, options) {
    return new Promise(function (resolve, reject) {
        var bsServer;
        try {
            bsServer = bs.get(name);
        } catch (e) {
            bsServer = bs.create(name);
        }
        bsServer.init({
            proxy: options.proxy,
            open: options.open,
            logPrefix: 'jdf',
            plugin: [
                {
                    module: 'bs-html-injector'
                }
            ]
        }, function () {
            resolve(options);
        });
    });
}