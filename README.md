# router [![Build Status](https://travis-ci.org/PT-FED/router.svg?branch=master)](https://travis-ci.org/PT-FED/router)
路由。此模块目前仅供PTFED内部使用

1. 获取指定路径html内容,异步!!!
2. 直接改变hash值 ==> 反向的 (可先抓取地址)
3. 嵌套 view
4. 选择器 querySelectorAll
5. 抓取地址 封装成指定路由 (同时可以获取对应页面内容)
6. 正则匹配地址
7. a标签click事件的绑定时机 ==> 如果有所有配置信息,可以只通过路由变化实现
8.



## 功能
- hash路由
- 获取路径或查询参数
- 支持错误处理
- 路由匹配前进行拦截处理
- 支持多路由匹配

## 如何使用
### 安装
```html
<script type="text/javascript" src="js/router.js">
```

### 配置项
构造函数可接受一个对象进行相关配置
```javascript
var options = {ignorecase: true}
var router = new Router(options);
```
有效的选项:

1. `ignorecase`:忽略大小写,默认为true

### 使用
- 支持字符串和正则
- 支持回调
```javascript
router.add('#/users', function(req,next){
    /*do something*/
}).add('#/users/:username', function(req,next){
    /*do something*/
}).add('#/users/*', function(req,next){
    /*do something*/
}).add('#/users/**', function(req,next){
    /*do something*/
});
```
Router实例参数说明:
```javascript
Router = {
    // 配置项
    _options: {
        ignorecase: true
    },
    // 路由触发前执行,通过router.before()方法进行配置
    _befores: [function(){}, function(){}],
    // 路由项,
    _routes: [{
        paramNames: [], // 路由参数
        path: "", // 正则路由地址
        routeAction: function(req, next){} // 路由行为函数
    },{}],
    // 错误处理,可通过router.errors()方法进行配置,覆盖默认处理
    _errors: {
        "_": function(httpcode, url){},
        "_404": function(httpcode, url){},
        "_500": function(httpcode, url){},
    }
}
```
Request实例参数说明:
```javascript
Request = {
    params: {},     // 路由参数
    query: {},      // 查询参数
    sqlat: [],      // 路由参数后路径
    hasNext: true,  // 是否存在下个路由
    href: ""        // 当前hash值
}
```
next()方法:
```javascript
router.before(function(req,next){
    userIsLogged() ? next() : next(403);
};
```
get()方法:
```javascript
router.add('#/users/:username', function(req,next){
    console.log(req.get("username"));   // 即可获取路径参数(支持默认值)
    console.log(req.get("uid", 18));    // 又可获取查询参数(支持默认值)
    if(req.params.username == "lg"){
        next(); // 被下一个再处理一次
    }
};
```
redirect()方法:


## 作者
李刚