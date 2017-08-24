/**
 * Copyright (c) 2016/09/27 ligang
 * https://github.com/PT-FED/router
 * 版本: 1.0.0
 * 描述: hash路由,兼容IE9+
 */
(function(global, name, factory){
    "use strict";

    if(typeof exports === 'object' && typeof module !== 'undefined'){
        module.exports = factory();
    }else if(typeof define === 'function' && (define.amd || define.cmd)){
        define(factory);
    }else{
        global[name] = factory();
    }
}(window || this, "Router", function(){
    "use strict";

    // 常量
    var VERSION = "1.0.0";

    /**
     * 内部工具类
     * @private
     */
    var _Utils = {
        PATH_NAME_MATCHER: /:([\w\d]+)/g,
        PATH_REPLACER: "([^\/\\?]+)",
        PATH_EVERY_MATCHER: /\/\*(?!\*)/,
        PATH_EVERY_REPLACER: "\/([^\/\\?]+)",
        PATH_EVERY_GLOBAL_MATCHER: /\*{2}/,
        PATH_EVERY_GLOBAL_REPLACER: "(.*?)\\??",
        LEADING_BACKSLASHES_MATCH: /\/*$/,
        /**
         * 继承[不支持嵌套]
         * @returns {T}
         * @private
         */
        extend: function(targetObj){
            var argumentsAry = Array.prototype.slice.call(arguments, 1), // 源对象
                sourceObj = null;                  //
            for(var i = 0, len = argumentsAry.length; i < len; i++){
                sourceObj = argumentsAry[i];
                for(var pop in sourceObj){
                    if(sourceObj.hasOwnProperty(pop)){
                        targetObj[pop] = sourceObj[pop];
                    }
                }
            }
            return targetObj;
        },
        /**
         * 提取URL的hash值
         * @param url
         * @returns {string}
         */
        getURLHash: function(url){
            var hashIndex = url.indexOf('#');
            return hashIndex >= 0 ? url.substring(hashIndex) : '#/';
        },
        /**
         * 去除URL尾反斜杠
         * @param url
         * @returns {string|XML|void}
         */
        removeTrailingSlash: function(url){
            return url.replace(_Utils.LEADING_BACKSLASHES_MATCH, '');
        },
        getHtmlContent: function(url, callback){
            if(!url) return callback(undefined);
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function(event){
                if (xhr.readyState == 4){
                    if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304){
                        callback(xhr.responseText);
                    } else {
                        console.error("Request was unsuccessful: " + xhr.status);
                        callback(undefined);
                    }
                }
            };
            xhr.open("get", url, true);
            xhr.send(null);
        }
    };

    /**
     * 内部事件
     * @private
     */
    var _Events = {
        addHashChangeListener: function(element, listener){
            element.addEventListener("hashchange", listener);
        },
        removeHashChangeListener: function(element, listener){
            element.removeEventListener("hashchange", listener);
        }
    };

    /**
     * Http Request 构造函数[实例独立属性]
     * @param href 请求URL
     * @constructor
     */
    var Request = function(href){
        this.href = href;
        this.params = {};
        this.query = {};
        this.splat = {};
        this.hasNext = false;
    };

    /**
     * 获取请求参数或查询参数[实例共享方法]
     * 注意:请求参数优先于查询参数
     * @param key   参数
     * @param defaultValue  如未获取到,返回该默认值
     */
    Request.prototype.get = function(key, defaultValue){
        return this.params[key] || this.query[key] || defaultValue;
    };

    /**
     * 路由构造函数
     * @params options 配置项
     * @public
     */
    var Router = function(options){
        this._options = _Utils.extend({ignorecase: true}, options || {});  // 默认忽略大小写
        this._states = [];
        this._befores = [];
        this._errors = {
            '_': function(httpCode, url) {
                console.warn("Router.js: " + httpCode);
            },
            '_404': function(httpCode, url) {
                console.warn("404! 无法匹配URL: " + url);
            },
            '_500': function(httpCode, url) {
                console.error("500! 发生错误: " + url);
            }
        };
        // 监听事件
        _Events.addHashChangeListener(window, this._hashChangeHandler.bind(this));
    };

    /**
     * 当前版本
     */
    Router.prototype.version = VERSION;

    /**
     * 用户自定义错误信息
     * @param httpCode
     * @param callback
     * @returns {Router}
     */
    Router.prototype.errors = function(httpCode, callback) {
        if(isNaN(httpCode)) {
            throw new Error('不合理的错误码,Router不能处理!');
        }
        if(!(callback instanceof Function)){
            throw new Error('不合理的callback,Router不能处理!');
        }
        this._errors['_' + httpCode] = callback;
        return this;
    };

    /**
     * 抛出错误信息
     * @param httpCode  错误码
     * @param err   错误信息
     * @param url   错误URL
     * @returns {boolean}
     * @private
     */
    Router.prototype._throwsRouteError = function(httpCode, url ) {
        if(this._errors['_'+httpCode] instanceof Function)
            this._errors['_'+httpCode](httpCode, url);
        else{
            this._errors._(httpCode, url);  // 兼容处理
        }
        return false;
    };

    /**
     * 监听hash变化事件
     * @param e
     * @returns {boolean}
     * @private
     */
    Router.prototype._hashChangeHandler = function(e){
        this._route(_Utils.getURLHash(window.location.href));
        return true;
    };

    // 构建request对象
    Router.prototype._buildRequestObject = function(fragmentUrl, params, splat, hasNext){
        var request = new Request(fragmentUrl);
        request.params = params || {};
        request.splat = splat || {};
        request.hasNext = hasNext;
        // 获取查询对象
        fragmentUrl.replace(/([^?&=]+)=([^&]+)/g, function(full, key, value){
            request.query[key] = value;
        });
        return request;
    };

    // 解构Request
    Router.prototype._resolveRequest = function(fragmentUrl, route){
        if(!route){
            return this._throwsRouteError(500);
        }

        var request = {
            params: {},     // 路由参数
            query: {},      // 查询参数
            splat: [],      // 路由参数后路径
            hasNext: true,  // 是否存在下个路由
            href: fragmentUrl        // 当前hash值
        };

        var fragmentUrlSlash = _Utils.removeTrailingSlash(fragmentUrl); // "#/users/lg/?a=1/" ==> "#/users/lg/?a=1"
        // 获取路径参数
        var matchResult = fragmentUrlSlash.match(route.path);
        matchResult ? matchResult.shift() : matchResult = [];
        for(var i = 0, len = route.paramNames.length; i < len; i++) {
            request.params[route.paramNames[i]] = matchResult.shift();
        }
        // 存在未被匹配的路径项,添加到splat中
        for(var j = 0; j< matchResult.length; j++){
            request.splat.push(matchResult.shift());
        }
        // 获取查询对象
        fragmentUrl.replace(/([^?&=]+)=([^&]+)/g, function(full, key, value){
            request.query[key] = value;
        });
        return request;
    };

    // 拦截路由
    Router.prototype._routeBefores = function(currentBefores, fragmentUrl, url,  matchedIndexes){
        var next,
            beforeAction = currentBefores.shift();   // currentBefores.length > 0
        if(currentBefores.length > 0){
            next = function(errorCode){
                if(errorCode)
                    return this._throwsRouteError(errorCode || 500, fragmentUrl);
                this._routeBefores(currentBefores, fragmentUrl, url, matchedIndexes);
            }.bind(this);
        }else{
            next = function(errorCode){
                if(errorCode)
                    return this._throwsRouteError(errorCode || 500, fragmentUrl);
                this._followRoute(fragmentUrl, url, matchedIndexes);
            }.bind(this);
        }
        beforeAction(this._buildRequestObject(fragmentUrl, null, null, true), next);
    };

    // 获取匹配的路由地址(可能多个)
    Router.prototype._route = function(fragmentUrl){
        var matchedIndexes = [],
            befores = this._befores.slice(),    // 深复制
            hash,
            routes = this._states;

        var url = fragmentUrl;
        if(url.length === 0){
            return true;
        }
        url = url.replace(_Utils.LEADING_BACKSLASHES_MATCH, '');                // "#/users/lg/?a=1/" ==> "#/users/lg/?a=1"
        hash = url.split("?")[0].replace(_Utils.LEADING_BACKSLASHES_MATCH, ''); // "#/users/lg/?a=1" ==> "#/users/lg"

        for(var i = 0, len = routes.length; i < len; i++){
            if(routes[i].path.test(hash)){
                matchedIndexes.push(i);     // 存储下标
            }
        }

        // 存在匹配的路由
        if(matchedIndexes.length > 0){
            if(befores.length > 0){
                this._routeBefores(befores, fragmentUrl, url,  matchedIndexes);
            }else{
                this._followRoute(fragmentUrl, url,  matchedIndexes);
            }
        }else{
            this._throwsRouteError(404, fragmentUrl);
        }
    };

    // 针对指定路由进行处理
    Router.prototype._followRoute = function(fragmentUrl, url, matchedIndexes){
        var index = matchedIndexes.shift(),  // 获取第一个匹配index
            state = this._states[index];

        // 解构Request对象
        var requestObj = this._resolveRequest(fragmentUrl, this._states[index]);

        // 判断是否存在符合要求的下一个路由
        var hasNext = (matchedIndexes.length !== 0);
        var next = function(errorCode){
            if(!hasNext || errorCode){  // 不存在下个路由,或存在错误码
                return this._throwsRouteError(500, fragmentUrl);
            }
            this._followRoute(fragmentUrl, url, matchedIndexes);
        }.bind(this);

        // 构建request对象
        var targetDomAry = document.querySelectorAll(state.target);
        for(var i = 0, len = targetDomAry.length; i < len; i++){
            targetDomAry[i].innerHTML = state.templateContent;
        }
        state.routeAction(this._buildRequestObject(fragmentUrl, requestObj.params, requestObj.splat, hasNext), next);
    };

    // 解构Route
    Router.prototype._resolveState = function(path, stateObj, callback){
        var that = this;
        return _Utils.getHtmlContent(stateObj.templateUrl, function(content){
            var templateContent = content || stateObj.template,
                match,
                state = {
                    "originalPath": path,
                    "state": stateObj,
                    "path": "",
                    "paramNames": [],
                    "target": stateObj.target,
                    "routeAction": stateObj.action,
                    "templateContent": templateContent
                };

            if(typeof path === "string"){
                // 移除最后的"/"
                path = _Utils.removeTrailingSlash(path);
                // 提取参数 '#/users/:username' ==> username
                while((match = _Utils.PATH_NAME_MATCHER.exec(path)) !== null){
                    state.paramNames.push(match[1]);
                }
                state.path = new RegExp(path.replace(_Utils.PATH_NAME_MATCHER, _Utils.PATH_REPLACER)      // "#/users/:username" ==> "#/users/([^/\?]+)"
                        .replace(_Utils.PATH_EVERY_MATCHER, _Utils.PATH_EVERY_REPLACER)
                        .replace(_Utils.PATH_EVERY_GLOBAL_MATCHER, _Utils.PATH_EVERY_GLOBAL_REPLACER) + "(?:\\?.+)?$",
                    that._options.ignorecase ? "i" : "");
            }
            return callback(state);
        });
    };

    // 添加路由
    Router.prototype.state = function(path, stateObj){
        var that = this;
        that._resolveState(path, stateObj, function(state){
            that._states.push(state);
        });
        return that;    // 上述方法有可能是异步的
    };

    // 路由匹配前执行一些操作
    Router.prototype.before = function(callback) {
        this._befores.push(callback);
        return this;
    };

    // 销毁路由
    Router.prototype.destroy = function(){
        // 移除监听
        _Events.removeHashChangeListener(window, this._hashChangeHandler);
    };

    // 重定向
    Router.prototype.redirect = function(url){
        // location.href = url;
        window.history.pushState(null, "", url);
        this._route(_Utils.getURLHash(url));
        return this;
    };

    return Router;
}));