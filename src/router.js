/**
 * Router
 * Created by ligang on 16/9/27.
 * 1. IE 9+
 */
(function(global, name, factory){
    "use strict";

    if(typeof exports === 'object' && typeof module !== 'undefined'){
        module.exports = factory();
    }else if(typeof define === 'function' && define.amd ){
        define(factory);
    }else{
        global[name] = factory();
    }
}(typeof window !== "undefined" ? window : this, "Router", function(){
    "use strict";

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
     * Http Request 构造函数
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
     * 获取请求参数或查询参数
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
        this._routes = [];
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
     * 用户自定义错误信息
     * @param httpCode
     * @param callback
     * @returns {Router}
     */
    Router.prototype.errors = function(httpCode, callback) {
        if(isNaN(httpCode)) {
            throw new Error('Invalid code for routes error handling');
        }
        if(!(callback instanceof Function)){
            throw new Error('Invalid callback for routes error handling');
        }
        httpCode = '_' + httpCode;
        this._errors[httpCode] = callback;
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
            this._errors._(httpCode, url);
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
        this._route(window.location.hash);
        return true;
    };

    /**
     * 路由处理程序(可能有多个符合)
     * @param hash
     * @private
     */
    Router.prototype._route = function(fragmentUrl){
        var matchedIndexes = [],
            befores = this._befores.slice(),    // 深复制
            hash;
        var url = fragmentUrl;
        if(url.length === 0){
            return true;
        }
        url = url.replace(_Utils.LEADING_BACKSLASHES_MATCH, '');                // "#/users/lg/?a=1/" ==> "#/users/lg/?a=1"
        hash = url.split("?")[0].replace(_Utils.LEADING_BACKSLASHES_MATCH, ''); // "#/users/lg/?a=1" ==> "#/users/lg"

        var routes = this._routes;
        for(var i = 0, len = routes.length; i < len; i++){
            if(routes[i].path.test(hash)){
                matchedIndexes.push(i);     // 存储下标
            }
        }

        // 存在匹配的路由
        if(matchedIndexes.length > 0){
            if(befores.length > 0){
                var currentBefore = befores.shift();
                this._routeBefores(befores, currentBefore, fragmentUrl, url,  matchedIndexes);
            }else{
                this._followRoute(fragmentUrl, url,  matchedIndexes);
            }
        }else{
            this._throwsRouteError(404, fragmentUrl);
        }
    };


    Router.prototype._routeBefores = function(befores, currentBefore, fragmentUrl, url,  matchedIndexes){
        var next;
        if(befores.length > 0){
            var nextBefore = befores.shift();
            next = function(errorCode, errorMsg){
                if(errorMsg)
                    return this._throwsRouteError(errorCode || 500, fragmentUrl);
                this._routeBefores(befores, nextBefore, fragmentUrl, url, matchedIndexes);
            }.bind(this);
        }else{
            next = function(errorCode, errorMsg){
                if(errorMsg)
                    return this._throwsRouteError(errorCode || 500, fragmentUrl);
                this._followRoute(fragmentUrl, url, matchedIndexes);
            }.bind(this);
        }
        // before(request, next);
        currentBefore(this._buildRequestObject(fragmentUrl, null, null, true), next);
    };

    /**
     *
     * @param fragmentUrl
     * @param url
     * @param matchedIndexes  ["1", "3"]
     * @private
     */
    Router.prototype._followRoute = function(fragmentUrl, url, matchedIndexes){
        var index = matchedIndexes.shift(),  // 获取第一个匹配index
            route = this._routes[index],
            match = url.match(route.path),  // ["#/users/lg?uid=211", "lg"]
            request,
            params = {},
            splat = [];

        if(!route){
            return this._throwsRouteError(500, fragmentUrl);
        }
        // 获取路径参数
        for(var i = 0, len = route.paramNames.length; i < len; i++) {
            params[route.paramNames[i]] = match[i + 1];
        }
        i = i+1;
        // 存在未被匹配的路径项,添加到splat中
        if(match && i < match.length){
            for(var j = i;j< match.length;j++){
                splat.push(match[j]);
            }
        }
        // 判断是否存在符合要求的下一个路由
        var hasNext = (matchedIndexes.length !== 0);
        var next = (
            function(nextFragmentUrl, nextUrl, nextMatchIndexes, hasNext){
                return function(hasNext){
                    if(!hasNext){
                        return this._throwsRouteError( 500, fragmentUrl);
                    }
                    this._followRoute(nextFragmentUrl, nextUrl, nextMatchIndexes);
                }.bind(this, hasNext);
            }.bind(this)(fragmentUrl, url, matchedIndexes, hasNext)
        );
        // 构建request对象
        request = this._buildRequestObject(fragmentUrl, params, splat, hasNext);
        route.routeAction(request, next);
    };

    /**
     * 构建request对象
     * @param fragmentUrl
     * @param params
     * @param splat
     * @param hasNext
     * @private
     */
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

    /**
     * 添加路由
     * @param path        路由地址
     * @param callback    回到函数
     * @public
     */
    Router.prototype.add = function(path, callback){
        var match,
            paramNames = [];
        if(typeof path === "string"){
            // 移除最后的"/"
            path = path.replace(_Utils.LEADING_BACKSLASHES_MATCH, "");
            // 提取参数 '#/users/:username' ==> username
            while((match = _Utils.PATH_NAME_MATCHER.exec(path)) !== null){
                paramNames.push(match[1]);
            }
            path = new RegExp(path.replace(_Utils.PATH_NAME_MATCHER, _Utils.PATH_REPLACER)      // "#/users/:username" ==> "#/users/([^/\?]+)"
                    .replace(_Utils.PATH_EVERY_MATCHER, _Utils.PATH_EVERY_REPLACER)
                    .replace(_Utils.PATH_EVERY_GLOBAL_MATCHER, _Utils.PATH_EVERY_GLOBAL_REPLACER) + "(?:\\?.+)?$",
                this._options.ignorecase ? "i" : "");
        }
        this._routes.push({
            'path' : path,
            'paramNames' : paramNames,
            'routeAction' : callback
        });
        return this;       // 支持链式调用
    };

    /**
     * 路由匹配前执行一些操作
     * @param callback
     * @returns {Router}
     */
    Router.prototype.before = function(callback) {
        this._befores.push(callback);
        return this;
    };

    /**
     * 销毁路由
     */
    Router.prototype.destroy = function(){
        // 移除监听
        _Events.removeHashChangeListener(window, this._hashChangeHandler);
    };

    return Router;
}));