# router [![Build Status](https://travis-ci.org/PT-FED/router.svg?branch=master)]
路由。此模块目前仅供PTFED内部使用

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

## 作者
李刚