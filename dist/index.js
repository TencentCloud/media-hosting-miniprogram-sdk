"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaHosting = void 0;
var MIN_PERIOD_SECONDS = 300;
var URL_PREFIX = 'https://smh.tencentcs.com/api/v1';
var MH = (function () {
    function MH(params) {
        this.tokenTimestamp = 0;
        this.tokenTimer = 0;
        var libraryId = params.libraryId, spaceId = params.spaceId, userId = params.userId, getAccessToken = params.getAccessToken;
        this.libraryId = libraryId;
        this._spaceId = spaceId;
        this._userId = userId;
        this.getAccessToken = getAccessToken;
    }
    Object.defineProperty(MH.prototype, "spaceId", {
        get: function () {
            return this._spaceId || '-';
        },
        set: function (value) {
            if (this._spaceId !== value) {
                this.updateToken(null);
            }
            this._spaceId = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(MH.prototype, "userId", {
        get: function () {
            return this._userId || '';
        },
        set: function (value) {
            if (this._userId !== value) {
                this.updateToken(null);
            }
            this._userId = value;
        },
        enumerable: false,
        configurable: true
    });
    MH.hasError = function (err, result) {
        return !!err;
    };
    MH.stringifyQueryString = function (query) {
        var queryList = [];
        for (var name in query) {
            var value = query[name];
            if (!Array.isArray(value)) {
                value = [value];
            }
            for (var _i = 0, value_1 = value; _i < value_1.length; _i++) {
                var subValue = value_1[_i];
                if (subValue === void 0) {
                    continue;
                }
                if (subValue === '') {
                    queryList.push(encodeURIComponent(name));
                }
                else {
                    queryList.push(encodeURIComponent(name) + "=" + encodeURIComponent(String(subValue)));
                }
            }
        }
        var queryString = queryList.length ? queryList.join('&') : '';
        return queryString;
    };
    MH.isRemoteError = function (data) {
        return typeof data === 'object' && typeof data.code === 'string' && typeof data.message === 'string';
    };
    MH.encodePath = function (path) {
        return path.split('/').filter(function (name) { return name; }).map(function (name) { return encodeURIComponent(name); }).join('/');
    };
    MH.prototype.updateToken = function (token, callback) {
        var _this = this;
        if (token && (typeof token.accessToken !== 'string' || !token.accessToken ||
            typeof token.expiresIn !== 'number' || token.expiresIn <= 0)) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.BaseError('Invalid token'));
        }
        if (token) {
            this.token = token;
        }
        else if (token === null) {
            this.token = void 0;
        }
        this.tokenTimestamp = Date.now();
        if (this.tokenTimer) {
            clearTimeout(this.tokenTimer);
        }
        if (this.token) {
            this.tokenTimer = setTimeout(function () { return _this.ensureToken(); }, (this.token.expiresIn - MIN_PERIOD_SECONDS) * 1000);
            callback === null || callback === void 0 ? void 0 : callback(null, this.token);
        }
    };
    MH.prototype.refreshToken = function (callback) {
        var _this = this;
        this.getAccessToken({
            libraryId: this.libraryId,
            spaceId: this.spaceId,
            userId: this.userId,
        }, function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            _this.updateToken(token, callback);
        });
    };
    MH.prototype.ensureToken = function (forceRenew, callback) {
        var _this = this;
        if (typeof forceRenew === 'function') {
            callback = forceRenew;
            forceRenew = void 0;
        }
        if (!this.token) {
            return this.refreshToken(callback);
        }
        var token = this.token;
        var sinceLastRefresh = Math.floor((Date.now() - this.tokenTimestamp) / 1000);
        if ((!forceRenew && this.token.expiresIn - sinceLastRefresh > MIN_PERIOD_SECONDS)
            || sinceLastRefresh < MIN_PERIOD_SECONDS) {
            return callback === null || callback === void 0 ? void 0 : callback(null, token);
        }
        wx.request({
            url: URL_PREFIX + "/token/" + this.libraryId + "/" + token.accessToken,
            method: 'POST',
            success: function (result) {
                var data = result.data;
                if (MH.isRemoteError(data)) {
                    if (data.code === 'InvalidAccessToken') {
                        return _this.refreshToken(callback);
                    }
                    return callback === null || callback === void 0 ? void 0 : callback(new MH.RemoteError(data.code, data.message));
                }
                var token = data;
                _this.updateToken(token, callback);
            },
            fail: function (res) {
                callback === null || callback === void 0 ? void 0 : callback(new MH.WxRequestError(res.errMsg));
            },
        });
    };
    MH.prototype.request = function (params, callback) {
        var _this = this;
        var subUrl = params.subUrl, method = params.method, _a = params.query, query = _a === void 0 ? {} : _a, _b = params.data, data = _b === void 0 ? {} : _b;
        var innerCallback = function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            query.access_token = token.accessToken;
            wx.request({
                url: "" + URL_PREFIX + subUrl + (subUrl.includes('?') ? '&' : '?') + MH.stringifyQueryString(query),
                method: method,
                data: data,
                success: function (result) {
                    var data = result.data;
                    if (MH.isRemoteError(data)) {
                        if (data.code === 'InvalidAccessToken') {
                            _this.updateToken(null);
                            return _this.ensureToken(innerCallback);
                        }
                        return callback === null || callback === void 0 ? void 0 : callback(new MH.RemoteError(data.code, data.message));
                    }
                    _this.updateToken();
                    callback === null || callback === void 0 ? void 0 : callback(null, {
                        statusCode: result.statusCode,
                        data: data,
                    });
                },
                fail: function (res) {
                    callback === null || callback === void 0 ? void 0 : callback(new MH.WxRequestError(res.errMsg));
                },
            });
        };
        this.ensureToken(innerCallback);
    };
    MH.prototype.createSpace = function (extension, callback) {
        var _this = this;
        var params = {
            subUrl: "/space/" + this.libraryId,
            method: 'POST',
        };
        if (typeof extension === 'function') {
            callback = extension;
            extension = void 0;
        }
        if (extension) {
            params.data = extension;
        }
        this.request(params, function (err, result) {
            if (MH.hasError(err, result)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            _this.spaceId = result.data.spaceId;
            callback === null || callback === void 0 ? void 0 : callback(null, result);
        });
    };
    MH.prototype.updateSpaceExtension = function (extension, callback) {
        this.request({
            subUrl: "/space/" + this.libraryId + "/" + this.spaceId + "/extension",
            method: 'POST',
            data: extension,
        }, callback);
    };
    MH.prototype.deleteSpace = function (callback) {
        var _this = this;
        this.request({
            subUrl: "/space/" + this.libraryId + "/" + this.spaceId,
            method: 'DELETE',
        }, function (err, result) {
            if (MH.hasError(err, result)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            _this.spaceId = '';
            callback === null || callback === void 0 ? void 0 : callback(null, result);
        });
    };
    MH.prototype.listDirectoryWithPagination = function (params, callback) {
        var path = params.path, marker = params.marker, limit = params.limit;
        this.request({
            subUrl: "/directory/" + this.libraryId + "/" + this.spaceId + "/" + (path ? MH.encodePath(path) : ''),
            method: 'GET',
            query: { marker: marker, limit: limit },
        }, function (err, result) {
            if (MH.hasError(err, result)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            if (result) {
                var contents = [];
                for (var _i = 0, _a = result.data.contents; _i < _a.length; _i++) {
                    var item = _a[_i];
                    contents.push({
                        name: item.name,
                        type: item.type,
                        creationTime: new Date(item.creationTime),
                    });
                }
                callback === null || callback === void 0 ? void 0 : callback(null, {
                    statusCode: result.statusCode,
                    data: {
                        path: result.data.path,
                        nextMarker: result.data.nextMarker,
                        contents: contents,
                    },
                });
            }
        });
    };
    MH.prototype.listDirectory = function (path, callback) {
        var _this = this;
        if (typeof path === 'function') {
            callback = path;
            path = void 0;
        }
        var innerPath = path || '';
        var returnPath = [];
        var contents = [];
        var marker = void 0;
        var retriedTimes = 0;
        var innerCallback = function (err, result) {
            if (MH.hasError(err, result)) {
                if (retriedTimes >= 2) {
                    return callback === null || callback === void 0 ? void 0 : callback(err);
                }
                retriedTimes++;
            }
            else if (result) {
                retriedTimes = 0;
                returnPath = result.data.path;
                contents = contents.concat(result.data.contents);
                if (result.data.nextMarker) {
                    marker = result.data.nextMarker;
                }
                else {
                    return callback === null || callback === void 0 ? void 0 : callback(null, { path: returnPath, contents: contents });
                }
            }
            _this.listDirectoryWithPagination({ path: innerPath, marker: marker }, innerCallback);
        };
        innerCallback(null);
    };
    MH.prototype.createDirectory = function (path, callback) {
        if (!path) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: "/directory/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(path),
            method: 'PUT',
        }, callback);
    };
    MH.prototype.deleteDirectory = function (path, callback) {
        if (!path) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: "/directory/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(path),
            method: 'DELETE',
        }, callback);
    };
    MH.prototype.moveDirectory = function (fromPath, toPath, callback) {
        if (!fromPath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param fromPath is empty.'));
        }
        if (!toPath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param toPath is empty.'));
        }
        this.request({
            subUrl: "/directory/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(toPath),
            method: 'PUT',
            data: {
                from: fromPath
            },
        }, callback);
    };
    MH.prototype.getCoverUrl = function (albumNameList, size, callback) {
        var _this = this;
        this.ensureToken(true, function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            if (!Array.isArray(albumNameList)) {
                albumNameList = [albumNameList];
            }
            if (typeof size === 'function') {
                callback = size;
                size = void 0;
            }
            var query = {
                access_token: token.accessToken,
                size: size,
            };
            var urls = albumNameList.map(function (albumName) { return URL_PREFIX + "/album/" + _this.libraryId + "/" + _this.spaceId + "/cover" + (albumName ? '/' + MH.encodePath(albumName) : '') + "?" + MH.stringifyQueryString(query); });
            callback === null || callback === void 0 ? void 0 : callback(null, urls);
        });
    };
    MH.prototype.getFileUrlWithQuery = function (pathList, query, callback) {
        var _this = this;
        if (typeof pathList === 'string' && !pathList || Array.isArray(pathList) && !pathList.length) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param path/pathList is empty.'));
        }
        this.ensureToken(true, function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            if (!Array.isArray(pathList)) {
                pathList = [pathList];
            }
            var urls = pathList.map(function (path) { return URL_PREFIX + "/file/" + _this.libraryId + "/" + _this.spaceId + "/" + MH.encodePath(path) + "?" + MH.stringifyQueryString(__assign(__assign({}, query), { access_token: token.accessToken })); });
            callback === null || callback === void 0 ? void 0 : callback(null, urls);
        });
    };
    MH.prototype.getFileUrl = function (pathList, callback) {
        this.getFileUrlWithQuery(pathList, {}, callback);
    };
    MH.prototype.getPreviewUrl = function (pathList, size, callback) {
        if (typeof size === 'function') {
            callback = size;
            size = void 0;
        }
        this.getFileUrlWithQuery(pathList, {
            preview: '',
            size: size,
        }, callback);
    };
    MH.prototype.uploadFile = function (remotePath, localPath, force, callback) {
        var _this = this;
        if (!remotePath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param remotePath is empty.'));
        }
        if (!localPath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param localPath is empty.'));
        }
        if (typeof force === 'function') {
            callback = force;
            force = void 0;
        }
        this.request({
            subUrl: "/file/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(remotePath),
            method: 'POST',
            query: {
                force: force ? 1 : 0,
            },
        }, function (err, result) {
            if (MH.hasError(err, result)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            var data = result.data;
            var domain = data.domain, form = data.form, confirmKey = data.confirmKey;
            wx.uploadFile({
                url: "https://" + domain + "/",
                filePath: localPath,
                name: 'file',
                formData: form,
                success: function (result) {
                    if (result.statusCode !== 204) {
                        return callback === null || callback === void 0 ? void 0 : callback(new MH.CosError(result.data));
                    }
                    _this.request({
                        subUrl: "/file/" + _this.libraryId + "/" + _this.spaceId + "/" + confirmKey + "?confirm",
                        method: 'POST',
                    }, callback);
                },
                fail: function (res) {
                    callback === null || callback === void 0 ? void 0 : callback(new MH.WxRequestError(res.errMsg));
                },
            });
        });
    };
    MH.prototype.deleteFile = function (path, callback) {
        if (!path) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: "/file/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(path),
            method: 'DELETE',
        }, callback);
    };
    MH.prototype.moveFile = function (fromPath, toPath, force, callback) {
        if (!fromPath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param fromPath is empty.'));
        }
        if (!toPath) {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Param toPath is empty.'));
        }
        if (typeof force === 'function') {
            callback = force;
            force = void 0;
        }
        this.request({
            subUrl: "/file/" + this.libraryId + "/" + this.spaceId + "/" + MH.encodePath(toPath),
            method: 'PUT',
            query: {
                force: force ? 1 : 0,
            },
            data: {
                from: fromPath
            },
        }, callback);
    };
    return MH;
}());
exports.MediaHosting = MH;
(function (MH) {
    var BaseError = (function (_super) {
        __extends(BaseError, _super);
        function BaseError(message) {
            var _newTarget = this.constructor;
            var _this = _super.call(this, message) || this;
            _this.name = _newTarget.name;
            var captureStackTrace = Error.captureStackTrace;
            if (typeof captureStackTrace === 'function') {
                captureStackTrace(_this, _newTarget);
            }
            if (typeof Object.setPrototypeOf === 'function') {
                Object.setPrototypeOf(_this, _newTarget.prototype);
            }
            else {
                _this.__proto__ = _newTarget.prototype;
            }
            return _this;
        }
        return BaseError;
    }(Error));
    MH.BaseError = BaseError;
    var ParamError = (function (_super) {
        __extends(ParamError, _super);
        function ParamError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return ParamError;
    }(BaseError));
    MH.ParamError = ParamError;
    var WxRequestError = (function (_super) {
        __extends(WxRequestError, _super);
        function WxRequestError() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        return WxRequestError;
    }(BaseError));
    MH.WxRequestError = WxRequestError;
    var RemoteError = (function (_super) {
        __extends(RemoteError, _super);
        function RemoteError(code, message) {
            var _this = _super.call(this, message) || this;
            _this.code = code;
            return _this;
        }
        return RemoteError;
    }(BaseError));
    MH.RemoteError = RemoteError;
    var CosError = (function (_super) {
        __extends(CosError, _super);
        function CosError(errorXml) {
            if (errorXml === void 0) { errorXml = ''; }
            var _a, _b, _c;
            var _this = this;
            var code = ((_a = /<Code>([^<]+)<\/Code>/i.exec(errorXml)) === null || _a === void 0 ? void 0 : _a[1]) || '';
            var message = ((_b = /<Message>([^<]+)<\/Message>/i.exec(errorXml)) === null || _b === void 0 ? void 0 : _b[1]) || '';
            var requestId = ((_c = /<RequestId>([^<]+)<\/RequestId>/i.exec(errorXml)) === null || _c === void 0 ? void 0 : _c[1]) || '';
            _this = _super.call(this, message) || this;
            _this.code = code;
            _this.requestId = requestId;
            return _this;
        }
        return CosError;
    }(BaseError));
    MH.CosError = CosError;
})(MH || (MH = {}));
exports.MediaHosting = MH;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFNQSxJQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztBQUsvQixJQUFNLFVBQVUsR0FBRyxrQ0FBa0MsQ0FBQztBQVN0RDtJQTBDSSxZQUFZLE1BQTRCO1FBUGhDLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1FBQzNCLGVBQVUsR0FBVyxDQUFDLENBQUM7UUFPbkIsSUFBQSxTQUFTLEdBQXNDLE1BQU0sVUFBNUMsRUFBRSxPQUFPLEdBQTZCLE1BQU0sUUFBbkMsRUFBRSxNQUFNLEdBQXFCLE1BQU0sT0FBM0IsRUFBRSxjQUFjLEdBQUssTUFBTSxlQUFYLENBQVk7UUFDOUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFFdEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDekMsQ0FBQztJQXhDRCxzQkFBSSx1QkFBTzthQUFYO1lBQ0ksT0FBTyxJQUFJLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQztRQUNoQyxDQUFDO2FBRUQsVUFBWSxLQUFhO1lBQ3JCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUI7WUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDOzs7T0FQQTtJQVVELHNCQUFJLHNCQUFNO2FBQVY7WUFDSSxPQUFPLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQzlCLENBQUM7YUFFRCxVQUFXLEtBQWE7WUFDcEIsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLEtBQUssRUFBRTtnQkFDeEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUMxQjtZQUNELElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxDQUFDO1FBQ3pCLENBQUM7OztPQVBBO0lBbUNjLFdBQVEsR0FBdkIsVUFBd0IsR0FBaUIsRUFBRSxNQUFXO1FBQ2xELE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQztJQUNqQixDQUFDO0lBT2MsdUJBQW9CLEdBQW5DLFVBQW9DLEtBQWU7UUFDL0MsSUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBQ3JCLEtBQUssSUFBTSxJQUFJLElBQUksS0FBSyxFQUFFO1lBQ3RCLElBQUksS0FBSyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QixJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsRUFBRTtnQkFDdkIsS0FBSyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDbkI7WUFDRCxLQUF1QixVQUFLLEVBQUwsZUFBSyxFQUFMLG1CQUFLLEVBQUwsSUFBSyxFQUFFO2dCQUF6QixJQUFNLFFBQVEsY0FBQTtnQkFDZixJQUFJLFFBQVEsS0FBSyxLQUFLLENBQUMsRUFBRTtvQkFDckIsU0FBUztpQkFDWjtnQkFDRCxJQUFJLFFBQVEsS0FBSyxFQUFFLEVBQUU7b0JBQ2pCLFNBQVMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztpQkFDNUM7cUJBQU07b0JBQ0gsU0FBUyxDQUFDLElBQUksQ0FBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsU0FBSSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUcsQ0FBQyxDQUFDO2lCQUN6RjthQUNKO1NBQ0o7UUFDRCxJQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDaEUsT0FBTyxXQUFXLENBQUM7SUFDdkIsQ0FBQztJQU9jLGdCQUFhLEdBQTVCLFVBQTZCLElBQVM7UUFDbEMsT0FBTyxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksT0FBTyxJQUFJLENBQUMsSUFBSSxLQUFLLFFBQVEsSUFBSSxPQUFPLElBQUksQ0FBQyxPQUFPLEtBQUssUUFBUSxDQUFDO0lBQ3pHLENBQUM7SUFPYyxhQUFVLEdBQXpCLFVBQTBCLElBQVk7UUFDbEMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksRUFBSixDQUFJLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsRUFBeEIsQ0FBd0IsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoRyxDQUFDO0lBRU8sd0JBQVcsR0FBbkIsVUFBb0IsS0FBNkIsRUFBRSxRQUFvQztRQUF2RixpQkFxQkM7UUFwQkcsSUFBSSxLQUFLLElBQUksQ0FDVCxPQUFPLEtBQUssQ0FBQyxXQUFXLEtBQUssUUFBUSxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVc7WUFDM0QsT0FBTyxLQUFLLENBQUMsU0FBUyxLQUFLLFFBQVEsSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLENBQUMsQ0FDOUQsRUFBRTtZQUNDLE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsRUFBRTtTQUN4RDtRQUNELElBQUksS0FBSyxFQUFFO1lBQ1AsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7U0FDdEI7YUFBTSxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7WUFFdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQztTQUN2QjtRQUNELElBQUksQ0FBQyxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQ2pDLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNqQixZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ2pDO1FBQ0QsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1osSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsY0FBTSxPQUFBLEtBQUksQ0FBQyxXQUFXLEVBQUUsRUFBbEIsQ0FBa0IsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLGtCQUFrQixDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7WUFDM0csUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxFQUFFO1NBQ2hDO0lBQ0wsQ0FBQztJQU1ELHlCQUFZLEdBQVosVUFBYSxRQUFvQztRQUFqRCxpQkFXQztRQVZHLElBQUksQ0FBQyxjQUFjLENBQUM7WUFDaEIsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTO1lBQ3pCLE9BQU8sRUFBRSxJQUFJLENBQUMsT0FBTztZQUNyQixNQUFNLEVBQUUsSUFBSSxDQUFDLE1BQU07U0FDdEIsRUFBRSxVQUFDLEdBQUcsRUFBRSxLQUFLO1lBQ1YsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRTtnQkFDekIsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsR0FBRyxFQUFFO2FBQzFCO1lBQ0QsS0FBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDdEMsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBYUQsd0JBQVcsR0FBWCxVQUFZLFVBQWdELEVBQUUsUUFBb0M7UUFBbEcsaUJBb0NDO1FBbkNHLElBQUksT0FBTyxVQUFVLEtBQUssVUFBVSxFQUFFO1lBQ2xDLFFBQVEsR0FBRyxVQUFVLENBQUM7WUFDdEIsVUFBVSxHQUFHLEtBQUssQ0FBQyxDQUFDO1NBQ3ZCO1FBQ0QsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDYixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7U0FDdEM7UUFDRCxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBTSxDQUFDO1FBQzFCLElBQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7UUFDL0UsSUFBSSxDQUFDLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLGdCQUFnQixHQUFHLGtCQUFrQixDQUFDO2VBQzFFLGdCQUFnQixHQUFHLGtCQUFrQixFQUFFO1lBRTFDLE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxLQUFLLEVBQUU7U0FDbEM7UUFDRCxFQUFFLENBQUMsT0FBTyxDQUFDO1lBQ1AsR0FBRyxFQUFLLFVBQVUsZUFBVSxJQUFJLENBQUMsU0FBUyxTQUFJLEtBQUssQ0FBQyxXQUFhO1lBQ2pFLE1BQU0sRUFBRSxNQUFNO1lBQ2QsT0FBTyxFQUFFLFVBQUMsTUFBTTtnQkFDSixJQUFBLElBQUksR0FBSyxNQUFNLEtBQVgsQ0FBWTtnQkFDeEIsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFO29CQUN4QixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssb0JBQW9CLEVBQUU7d0JBRXBDLE9BQU8sS0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztxQkFDdEM7b0JBRUQsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2lCQUNsRTtnQkFDRCxJQUFNLEtBQUssR0FBRyxJQUFzQixDQUFDO2dCQUNyQyxLQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN0QyxDQUFDO1lBQ0QsSUFBSSxFQUFFLFVBQUMsR0FBRztnQkFFTixRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsRUFBRTtZQUNsRCxDQUFDO1NBQ0osQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQVFPLG9CQUFPLEdBQWYsVUFBd0IsTUFBd0IsRUFBRSxRQUFnQztRQUFsRixpQkFpQ0M7UUFoQ1csSUFBQSxNQUFNLEdBQW9DLE1BQU0sT0FBMUMsRUFBRSxNQUFNLEdBQTRCLE1BQU0sT0FBbEMsRUFBRSxLQUEwQixNQUFNLE1BQXRCLEVBQVYsS0FBSyxtQkFBRyxFQUFFLEtBQUEsRUFBRSxLQUFjLE1BQU0sS0FBWCxFQUFULElBQUksbUJBQUcsRUFBRSxLQUFBLENBQVk7UUFDekQsSUFBTSxhQUFhLEdBQThCLFVBQUMsR0FBRyxFQUFFLEtBQUs7WUFDeEQsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxLQUFLLENBQUMsRUFBRTtnQkFDekIsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsR0FBRyxFQUFFO2FBQzFCO1lBQ0QsS0FBSyxDQUFDLFlBQVksR0FBRyxLQUFLLENBQUMsV0FBVyxDQUFDO1lBQ3ZDLEVBQUUsQ0FBQyxPQUFPLENBQUM7Z0JBQ1AsR0FBRyxFQUFFLEtBQUcsVUFBVSxHQUFHLE1BQU0sSUFBRyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEdBQUcsSUFBRyxFQUFFLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFHO2dCQUNqRyxNQUFNLFFBQUE7Z0JBQ04sSUFBSSxNQUFBO2dCQUNKLE9BQU8sRUFBRSxVQUFDLE1BQU07b0JBQ1osSUFBTSxJQUFJLEdBQUcsTUFBTSxDQUFDLElBQVMsQ0FBQztvQkFFOUIsSUFBSSxFQUFFLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxFQUFFO3dCQUN4QixJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssb0JBQW9CLEVBQUU7NEJBQ3BDLEtBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7NEJBQ3ZCLE9BQU8sS0FBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQzt5QkFDMUM7d0JBQ0QsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO3FCQUNsRTtvQkFDRCxLQUFJLENBQUMsV0FBVyxFQUFFLENBQUM7b0JBQ25CLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUU7d0JBQ2IsVUFBVSxFQUFFLE1BQU0sQ0FBQyxVQUFVO3dCQUM3QixJQUFJLE1BQUE7cUJBQ1AsRUFBRTtnQkFDUCxDQUFDO2dCQUNELElBQUksRUFBRSxVQUFDLEdBQUc7b0JBQ04sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2xELENBQUM7YUFDSixDQUFDLENBQUM7UUFDUCxDQUFDLENBQUM7UUFDRixJQUFJLENBQUMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFhRCx3QkFBVyxHQUFYLFVBQVksU0FBc0QsRUFBRSxRQUFpQztRQUFyRyxpQkFtQkM7UUFsQkcsSUFBTSxNQUFNLEdBQXFCO1lBQzdCLE1BQU0sRUFBRSxZQUFVLElBQUksQ0FBQyxTQUFXO1lBQ2xDLE1BQU0sRUFBRSxNQUFNO1NBQ2pCLENBQUM7UUFDRixJQUFJLE9BQU8sU0FBUyxLQUFLLFVBQVUsRUFBRTtZQUNqQyxRQUFRLEdBQUcsU0FBUyxDQUFDO1lBQ3JCLFNBQVMsR0FBRyxLQUFLLENBQUMsQ0FBQztTQUN0QjtRQUNELElBQUksU0FBUyxFQUFFO1lBQ1gsTUFBTSxDQUFDLElBQUksR0FBRyxTQUFTLENBQUM7U0FDM0I7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUF1QixNQUFNLEVBQUUsVUFBQyxHQUFHLEVBQUUsTUFBTTtZQUNuRCxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUMxQixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7YUFDMUI7WUFDRCxLQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ25DLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsTUFBTSxFQUFFO1FBQzdCLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQU9ELGlDQUFvQixHQUFwQixVQUFxQixTQUF5QyxFQUFFLFFBQTZCO1FBQ3pGLElBQUksQ0FBQyxPQUFPLENBQUM7WUFDVCxNQUFNLEVBQUUsWUFBVSxJQUFJLENBQUMsU0FBUyxTQUFJLElBQUksQ0FBQyxPQUFPLGVBQVk7WUFDNUQsTUFBTSxFQUFFLE1BQU07WUFDZCxJQUFJLEVBQUUsU0FBUztTQUNsQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFNRCx3QkFBVyxHQUFYLFVBQVksUUFBNkI7UUFBekMsaUJBV0M7UUFWRyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ1QsTUFBTSxFQUFFLFlBQVUsSUFBSSxDQUFDLFNBQVMsU0FBSSxJQUFJLENBQUMsT0FBUztZQUNsRCxNQUFNLEVBQUUsUUFBUTtTQUNuQixFQUFFLFVBQUMsR0FBRyxFQUFFLE1BQU07WUFDWCxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUMxQixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7YUFDMUI7WUFDRCxLQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNsQixRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLE1BQU0sRUFBRTtRQUM3QixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFPRCx3Q0FBMkIsR0FBM0IsVUFBNEIsTUFBNEMsRUFBRSxRQUFpRDtRQUMvRyxJQUFBLElBQUksR0FBb0IsTUFBTSxLQUExQixFQUFFLE1BQU0sR0FBWSxNQUFNLE9BQWxCLEVBQUUsS0FBSyxHQUFLLE1BQU0sTUFBWCxDQUFZO1FBQ3ZDLElBQUksQ0FBQyxPQUFPLENBQTJCO1lBQ25DLE1BQU0sRUFBRSxnQkFBYyxJQUFJLENBQUMsU0FBUyxTQUFJLElBQUksQ0FBQyxPQUFPLFVBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUU7WUFDekYsTUFBTSxFQUFFLEtBQUs7WUFDYixLQUFLLEVBQUUsRUFBRSxNQUFNLFFBQUEsRUFBRSxLQUFLLE9BQUEsRUFBRTtTQUMzQixFQUFFLFVBQUMsR0FBRyxFQUFFLE1BQU07WUFDWCxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLE1BQU0sQ0FBQyxFQUFFO2dCQUMxQixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7YUFDMUI7WUFDRCxJQUFJLE1BQU0sRUFBRTtnQkFDUixJQUFNLFFBQVEsR0FBMEIsRUFBRSxDQUFDO2dCQUMzQyxLQUFtQixVQUFvQixFQUFwQixLQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFwQixjQUFvQixFQUFwQixJQUFvQixFQUFFO29CQUFwQyxJQUFNLElBQUksU0FBQTtvQkFDWCxRQUFRLENBQUMsSUFBSSxDQUFDO3dCQUNWLElBQUksRUFBRSxJQUFJLENBQUMsSUFBSTt3QkFDZixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7d0JBQ2YsWUFBWSxFQUFFLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7cUJBQzVDLENBQUMsQ0FBQztpQkFDTjtnQkFDRCxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFO29CQUNiLFVBQVUsRUFBRSxNQUFNLENBQUMsVUFBVTtvQkFDN0IsSUFBSSxFQUFFO3dCQUNGLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUk7d0JBQ3RCLFVBQVUsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVU7d0JBQ2xDLFFBQVEsVUFBQTtxQkFDWDtpQkFDSixFQUFFO2FBQ047UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFhRCwwQkFBYSxHQUFiLFVBQWMsSUFBd0MsRUFBRSxRQUFtQztRQUEzRixpQkE2QkM7UUE1QkcsSUFBSSxPQUFPLElBQUksS0FBSyxVQUFVLEVBQUU7WUFDNUIsUUFBUSxHQUFHLElBQUksQ0FBQztZQUNoQixJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUM7U0FDakI7UUFDRCxJQUFNLFNBQVMsR0FBRyxJQUFJLElBQUksRUFBRSxDQUFDO1FBQzdCLElBQUksVUFBVSxHQUFhLEVBQUUsQ0FBQztRQUM5QixJQUFJLFFBQVEsR0FBMEIsRUFBRSxDQUFDO1FBQ3pDLElBQUksTUFBTSxHQUF1QixLQUFLLENBQUMsQ0FBQztRQUN4QyxJQUFJLFlBQVksR0FBRyxDQUFDLENBQUM7UUFDckIsSUFBSSxhQUFhLEdBQTJDLFVBQUMsR0FBRyxFQUFFLE1BQU07WUFDcEUsSUFBSSxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDMUIsSUFBSSxZQUFZLElBQUksQ0FBQyxFQUFFO29CQUNuQixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7aUJBQzFCO2dCQUNELFlBQVksRUFBRSxDQUFDO2FBQ2xCO2lCQUFNLElBQUksTUFBTSxFQUFFO2dCQUNmLFlBQVksR0FBRyxDQUFDLENBQUM7Z0JBQ2pCLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDOUIsUUFBUSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDakQsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtvQkFDeEIsTUFBTSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2lCQUNuQztxQkFBTTtvQkFDSCxPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLFFBQVEsVUFBQSxFQUFFLEVBQUU7aUJBQzNEO2FBQ0o7WUFDRCxLQUFJLENBQUMsMkJBQTJCLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLE1BQU0sUUFBQSxFQUFFLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDakYsQ0FBQyxDQUFDO1FBQ0YsYUFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFPRCw0QkFBZSxHQUFmLFVBQWdCLElBQVksRUFBRSxRQUE2QjtRQUN2RCxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1AsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLEVBQUU7U0FDaEU7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ1QsTUFBTSxFQUFFLGdCQUFjLElBQUksQ0FBQyxTQUFTLFNBQUksSUFBSSxDQUFDLE9BQU8sU0FBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBRztZQUM3RSxNQUFNLEVBQUUsS0FBSztTQUNoQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFPRCw0QkFBZSxHQUFmLFVBQWdCLElBQVksRUFBRSxRQUE2QjtRQUN2RCxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1AsT0FBTyxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLENBQUMsVUFBVSxDQUFDLHNCQUFzQixDQUFDLEVBQUU7U0FDaEU7UUFDRCxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQ1QsTUFBTSxFQUFFLGdCQUFjLElBQUksQ0FBQyxTQUFTLFNBQUksSUFBSSxDQUFDLE9BQU8sU0FBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBRztZQUM3RSxNQUFNLEVBQUUsUUFBUTtTQUNuQixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFRRCwwQkFBYSxHQUFiLFVBQWMsUUFBZ0IsRUFBRSxNQUFjLEVBQUUsUUFBNkI7UUFDekUsSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNYLE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQywwQkFBMEIsQ0FBQyxFQUFFO1NBQ3BFO1FBQ0QsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUNULE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFO1NBQ2xFO1FBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNULE1BQU0sRUFBRSxnQkFBYyxJQUFJLENBQUMsU0FBUyxTQUFJLElBQUksQ0FBQyxPQUFPLFNBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUc7WUFDL0UsTUFBTSxFQUFFLEtBQUs7WUFDYixJQUFJLEVBQUU7Z0JBQ0YsSUFBSSxFQUFFLFFBQVE7YUFDakI7U0FDSixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUE0QkQsd0JBQVcsR0FBWCxVQUFZLGFBQWdDLEVBQUUsSUFBaUMsRUFBRSxRQUE0QjtRQUE3RyxpQkFtQkM7UUFsQkcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBQyxHQUFHLEVBQUUsS0FBSztZQUM5QixJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUN6QixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7YUFDMUI7WUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsRUFBRTtnQkFDL0IsYUFBYSxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7YUFDbkM7WUFDRCxJQUFJLE9BQU8sSUFBSSxLQUFLLFVBQVUsRUFBRTtnQkFDNUIsUUFBUSxHQUFHLElBQUksQ0FBQztnQkFDaEIsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDO2FBQ2pCO1lBQ0QsSUFBTSxLQUFLLEdBQWE7Z0JBQ3BCLFlBQVksRUFBRSxLQUFLLENBQUMsV0FBVztnQkFDL0IsSUFBSSxNQUFBO2FBQ1AsQ0FBQztZQUNGLElBQU0sSUFBSSxHQUFHLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBQSxTQUFTLElBQUksT0FBRyxVQUFVLGVBQVUsS0FBSSxDQUFDLFNBQVMsU0FBSSxLQUFJLENBQUMsT0FBTyxlQUFTLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsVUFBSSxFQUFFLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFHLEVBQWpKLENBQWlKLENBQUMsQ0FBQztZQUMvTCxRQUFRLGFBQVIsUUFBUSx1QkFBUixRQUFRLENBQUcsSUFBSSxFQUFFLElBQUksRUFBRTtRQUMzQixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxnQ0FBbUIsR0FBM0IsVUFBNEIsUUFBMkIsRUFBRSxLQUFlLEVBQUUsUUFBNEI7UUFBdEcsaUJBaUJDO1FBaEJHLElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxJQUFJLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFO1lBQzFGLE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQywrQkFBK0IsQ0FBQyxFQUFFO1NBQ3pFO1FBQ0QsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsVUFBQyxHQUFHLEVBQUUsS0FBSztZQUM5QixJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsR0FBRyxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUN6QixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxHQUFHLEVBQUU7YUFDMUI7WUFDRCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDMUIsUUFBUSxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDekI7WUFDRCxJQUFNLElBQUksR0FBRyxRQUFRLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUcsVUFBVSxjQUFTLEtBQUksQ0FBQyxTQUFTLFNBQUksS0FBSSxDQUFDLE9BQU8sU0FBSSxFQUFFLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxTQUFJLEVBQUUsQ0FBQyxvQkFBb0IsdUJBQ2pJLEtBQUssS0FDUixZQUFZLEVBQUUsS0FBSyxDQUFDLFdBQVcsSUFDL0IsRUFIOEIsQ0FHOUIsQ0FBQyxDQUFDO1lBQ04sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxJQUFJLEVBQUU7UUFDM0IsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBY0QsdUJBQVUsR0FBVixVQUFXLFFBQTJCLEVBQUUsUUFBNEI7UUFDaEUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQTRCRCwwQkFBYSxHQUFiLFVBQWMsUUFBMkIsRUFBRSxJQUFpQyxFQUFFLFFBQTRCO1FBQ3RHLElBQUksT0FBTyxJQUFJLEtBQUssVUFBVSxFQUFFO1lBQzVCLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDaEIsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDO1NBQ2pCO1FBQ0QsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRTtZQUMvQixPQUFPLEVBQUUsRUFBRTtZQUNYLElBQUksTUFBQTtTQUNQLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDakIsQ0FBQztJQWlCRCx1QkFBVSxHQUFWLFVBQVcsVUFBa0IsRUFBRSxTQUFpQixFQUFFLEtBQW1DLEVBQUUsUUFBNEI7UUFBbkgsaUJBMENDO1FBekNHLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDYixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsNEJBQTRCLENBQUMsRUFBRTtTQUN0RTtRQUNELElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDWixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsMkJBQTJCLENBQUMsRUFBRTtTQUNyRTtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxFQUFFO1lBQzdCLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFDakIsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDO1NBQ2xCO1FBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBdUI7WUFDL0IsTUFBTSxFQUFFLFdBQVMsSUFBSSxDQUFDLFNBQVMsU0FBSSxJQUFJLENBQUMsT0FBTyxTQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFHO1lBQzlFLE1BQU0sRUFBRSxNQUFNO1lBQ2QsS0FBSyxFQUFFO2dCQUNILEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzthQUN2QjtTQUNKLEVBQUUsVUFBQyxHQUFHLEVBQUUsTUFBTTtZQUNYLElBQUksRUFBRSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsTUFBTSxDQUFDLEVBQUU7Z0JBQzFCLE9BQU8sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLEdBQUcsRUFBRTthQUMxQjtZQUNPLElBQUEsSUFBSSxHQUFLLE1BQU0sS0FBWCxDQUFZO1lBQ2hCLElBQUEsTUFBTSxHQUF1QixJQUFJLE9BQTNCLEVBQUUsSUFBSSxHQUFpQixJQUFJLEtBQXJCLEVBQUUsVUFBVSxHQUFLLElBQUksV0FBVCxDQUFVO1lBQzFDLEVBQUUsQ0FBQyxVQUFVLENBQUM7Z0JBQ1YsR0FBRyxFQUFFLGFBQVcsTUFBTSxNQUFHO2dCQUN6QixRQUFRLEVBQUUsU0FBUztnQkFDbkIsSUFBSSxFQUFFLE1BQU07Z0JBQ1osUUFBUSxFQUFFLElBQUk7Z0JBQ2QsT0FBTyxFQUFFLFVBQUMsTUFBTTtvQkFDWixJQUFJLE1BQU0sQ0FBQyxVQUFVLEtBQUssR0FBRyxFQUFFO3dCQUMzQixPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFO3FCQUNuRDtvQkFDRCxLQUFJLENBQUMsT0FBTyxDQUFDO3dCQUNULE1BQU0sRUFBRSxXQUFTLEtBQUksQ0FBQyxTQUFTLFNBQUksS0FBSSxDQUFDLE9BQU8sU0FBSSxVQUFVLGFBQVU7d0JBQ3ZFLE1BQU0sRUFBRSxNQUFNO3FCQUNqQixFQUFFLFFBQVEsQ0FBQyxDQUFDO2dCQUNqQixDQUFDO2dCQUNELElBQUksRUFBRSxVQUFDLEdBQUc7b0JBQ04sUUFBUSxhQUFSLFFBQVEsdUJBQVIsUUFBUSxDQUFHLElBQUksRUFBRSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ2xELENBQUM7YUFDSixDQUFDLENBQUE7UUFDTixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFPRCx1QkFBVSxHQUFWLFVBQVcsSUFBWSxFQUFFLFFBQTZCO1FBQ2xELElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDUCxPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsc0JBQXNCLENBQUMsRUFBRTtTQUNoRTtRQUNELElBQUksQ0FBQyxPQUFPLENBQUM7WUFDVCxNQUFNLEVBQUUsV0FBUyxJQUFJLENBQUMsU0FBUyxTQUFJLElBQUksQ0FBQyxPQUFPLFNBQUksRUFBRSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUc7WUFDeEUsTUFBTSxFQUFFLFFBQVE7U0FDbkIsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNqQixDQUFDO0lBaUJELHFCQUFRLEdBQVIsVUFBUyxRQUFnQixFQUFFLE1BQWMsRUFBRSxLQUFtQyxFQUFFLFFBQTRCO1FBQ3hHLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDWCxPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUMsRUFBRTtTQUNwRTtRQUNELElBQUksQ0FBQyxNQUFNLEVBQUU7WUFDVCxPQUFPLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRyxJQUFJLEVBQUUsQ0FBQyxVQUFVLENBQUMsd0JBQXdCLENBQUMsRUFBRTtTQUNsRTtRQUNELElBQUksT0FBTyxLQUFLLEtBQUssVUFBVSxFQUFFO1lBQzdCLFFBQVEsR0FBRyxLQUFLLENBQUM7WUFDakIsS0FBSyxHQUFHLEtBQUssQ0FBQyxDQUFDO1NBQ2xCO1FBQ0QsSUFBSSxDQUFDLE9BQU8sQ0FBQztZQUNULE1BQU0sRUFBRSxXQUFTLElBQUksQ0FBQyxTQUFTLFNBQUksSUFBSSxDQUFDLE9BQU8sU0FBSSxFQUFFLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBRztZQUMxRSxNQUFNLEVBQUUsS0FBSztZQUNiLEtBQUssRUFBRTtnQkFDSCxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDdkI7WUFDRCxJQUFJLEVBQUU7Z0JBQ0YsSUFBSSxFQUFFLFFBQVE7YUFDakI7U0FDSixFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQ2pCLENBQUM7SUFDTCxTQUFDO0FBQUQsQ0FBQyxBQW5wQkQsSUFtcEJDO0FBMlJjLDBCQUFZO0FBelIzQixXQUFVLEVBQUU7SUFHUjtRQUErQiw2QkFBSztRQUNoQyxtQkFBWSxPQUFlOztZQUEzQixZQUNJLGtCQUFNLE9BQU8sQ0FBQyxTQVdqQjtZQVZHLEtBQUksQ0FBQyxJQUFJLEdBQUcsV0FBVyxJQUFJLENBQUM7WUFDcEIsSUFBQSxpQkFBaUIsR0FBSyxLQUFZLGtCQUFqQixDQUFrQjtZQUMzQyxJQUFJLE9BQU8saUJBQWlCLEtBQUssVUFBVSxFQUFFO2dCQUN6QyxpQkFBaUIsQ0FBQyxLQUFJLGFBQWEsQ0FBQzthQUN2QztZQUNELElBQUksT0FBTyxNQUFNLENBQUMsY0FBYyxLQUFLLFVBQVUsRUFBRTtnQkFDN0MsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFJLEVBQUUsV0FBVyxTQUFTLENBQUMsQ0FBQzthQUNyRDtpQkFBTTtnQkFDRixLQUFZLENBQUMsU0FBUyxHQUFHLFdBQVcsU0FBUyxDQUFDO2FBQ2xEOztRQUNMLENBQUM7UUFDTCxnQkFBQztJQUFELENBQUMsQUFkRCxDQUErQixLQUFLLEdBY25DO0lBZFksWUFBUyxZQWNyQixDQUFBO0lBR0Q7UUFBZ0MsOEJBQVM7UUFBekM7O1FBQTRDLENBQUM7UUFBRCxpQkFBQztJQUFELENBQUMsQUFBN0MsQ0FBZ0MsU0FBUyxHQUFJO0lBQWhDLGFBQVUsYUFBc0IsQ0FBQTtJQUc3QztRQUFvQyxrQ0FBUztRQUE3Qzs7UUFBZ0QsQ0FBQztRQUFELHFCQUFDO0lBQUQsQ0FBQyxBQUFqRCxDQUFvQyxTQUFTLEdBQUk7SUFBcEMsaUJBQWMsaUJBQXNCLENBQUE7SUFHakQ7UUFBaUMsK0JBQVM7UUFXdEMscUJBQVksSUFBWSxFQUFFLE9BQWU7WUFBekMsWUFDSSxrQkFBTSxPQUFPLENBQUMsU0FFakI7WUFERyxLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQzs7UUFDckIsQ0FBQztRQUNMLGtCQUFDO0lBQUQsQ0FBQyxBQWZELENBQWlDLFNBQVMsR0FlekM7SUFmWSxjQUFXLGNBZXZCLENBQUE7SUFHRDtRQUE4Qiw0QkFBUztRQVluQyxrQkFBWSxRQUFxQjtZQUFyQix5QkFBQSxFQUFBLGFBQXFCOztZQUFqQyxpQkFPQztZQU5HLElBQU0sSUFBSSxHQUFHLE9BQUEsd0JBQXdCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQywwQ0FBRyxDQUFDLE1BQUssRUFBRSxDQUFDO1lBQ2hFLElBQU0sT0FBTyxHQUFHLE9BQUEsOEJBQThCLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQywwQ0FBRyxDQUFDLE1BQUssRUFBRSxDQUFDO1lBQ3pFLElBQU0sU0FBUyxHQUFHLE9BQUEsa0NBQWtDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQywwQ0FBRyxDQUFDLE1BQUssRUFBRSxDQUFDO1lBQy9FLFFBQUEsa0JBQU0sT0FBTyxDQUFDLFNBQUM7WUFDZixLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztZQUNqQixLQUFJLENBQUMsU0FBUyxHQUFHLFNBQVMsQ0FBQzs7UUFDL0IsQ0FBQztRQUNMLGVBQUM7SUFBRCxDQUFDLEFBcEJELENBQThCLFNBQVMsR0FvQnRDO0lBcEJZLFdBQVEsV0FvQnBCLENBQUE7QUFxTUwsQ0FBQyxFQXJRUyxFQUFFLEtBQUYsRUFBRSxRQXFRWDtBQW9CYywwQkFBWSIsInNvdXJjZXNDb250ZW50IjpbIi8qKiDlqpLotYTmiZjnrqHlrqLmiLfnq6/lsI/nqIvluo8gU0RLICovXHJcblxyXG4vKipcclxuICog6K6/6Zeu5Luk54mM5pyA5bCP5pyJ5pWI5pe26ZW/77yM5b2T6K6/6Zeu5Luk54mM5Ymp5L2Z5pyJ5pWI5pe26ZW/5L2O5LqO6K+l5YC85pe277yM5bCG6Kem5Y+R57ut5pyf5oiW5Yi35paw6K6/6Zeu5Luk54mM44CCXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5jb25zdCBNSU5fUEVSSU9EX1NFQ09ORFMgPSAzMDA7XHJcbi8qKlxyXG4gKiDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqEgVVJMIOWJjee8gFxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuY29uc3QgVVJMX1BSRUZJWCA9ICdodHRwczovL3NtaC50ZW5jZW50Y3MuY29tL2FwaS92MSc7XHJcblxyXG4vKipcclxuICog5aqS6LWE5omY566h5a6i5oi356uv44CC6K+l57G75ZKM5ZG95ZCN56m66Ze05L2/55So5ZCN5a2XIE1lZGlhSG9zdGluZyDlr7zlh7rvvJpcclxuICogXHJcbiAqIGBgYGpzXHJcbiAqIGV4cG9ydCB7IE1IIGFzIE1lZGlhSG9zdGluZyB9O1xyXG4gKiBgYGBcclxuICovXHJcbmNsYXNzIE1IIHtcclxuXHJcbiAgICBwcml2YXRlIF9zcGFjZUlkPzogc3RyaW5nO1xyXG4gICAgcHJpdmF0ZSBfdXNlcklkPzogc3RyaW5nO1xyXG5cclxuICAgIC8qKiDojrflj5blvZPliY3mjIflrprnmoTlqpLkvZPlupMgSUQgKi9cclxuICAgIHJlYWRvbmx5IGxpYnJhcnlJZDogc3RyaW5nO1xyXG5cclxuICAgIC8qKiDojrflj5blvZPliY3mjIflrprnmoTnp5/miLfnqbrpl7QgSUQgKi9cclxuICAgIGdldCBzcGFjZUlkKCkge1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9zcGFjZUlkIHx8ICctJztcclxuICAgIH1cclxuICAgIC8qKiDorr7nva7np5/miLfnqbrpl7QgSUQgKi9cclxuICAgIHNldCBzcGFjZUlkKHZhbHVlOiBzdHJpbmcpIHtcclxuICAgICAgICBpZiAodGhpcy5fc3BhY2VJZCAhPT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVUb2tlbihudWxsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fc3BhY2VJZCA9IHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDojrflj5blvZPliY3mjIflrprnmoTnlKjmiLcgSUQgKi9cclxuICAgIGdldCB1c2VySWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3VzZXJJZCB8fCAnJztcclxuICAgIH1cclxuICAgIC8qKiDorr7nva7nlKjmiLcgSUQgKi9cclxuICAgIHNldCB1c2VySWQodmFsdWU6IHN0cmluZykge1xyXG4gICAgICAgIGlmICh0aGlzLl91c2VySWQgIT09IHZhbHVlKSB7XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4obnVsbCk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX3VzZXJJZCA9IHZhbHVlO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgcmVhZG9ubHkgZ2V0QWNjZXNzVG9rZW46IE1ILkdldEFjY2Vzc1Rva2VuRnVuYztcclxuXHJcbiAgICBwcml2YXRlIHRva2VuPzogTUguQWNjZXNzVG9rZW47XHJcbiAgICBwcml2YXRlIHRva2VuVGltZXN0YW1wOiBudW1iZXIgPSAwO1xyXG4gICAgcHJpdmF0ZSB0b2tlblRpbWVyOiBudW1iZXIgPSAwO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5a6e5L6L5YyW5aqS6LWE5omY566h5a6i5oi356uvXHJcbiAgICAgKiBAcGFyYW0gcGFyYW1zIOWunuS+i+WMluWPguaVsFxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3RvcihwYXJhbXM6IE1ILkNvbnN0cnVjdG9yUGFyYW1zKSB7XHJcbiAgICAgICAgY29uc3QgeyBsaWJyYXJ5SWQsIHNwYWNlSWQsIHVzZXJJZCwgZ2V0QWNjZXNzVG9rZW4gfSA9IHBhcmFtcztcclxuICAgICAgICB0aGlzLmxpYnJhcnlJZCA9IGxpYnJhcnlJZDtcclxuICAgICAgICB0aGlzLl9zcGFjZUlkID0gc3BhY2VJZDtcclxuICAgICAgICB0aGlzLl91c2VySWQgPSB1c2VySWQ7XHJcblxyXG4gICAgICAgIHRoaXMuZ2V0QWNjZXNzVG9rZW4gPSBnZXRBY2Nlc3NUb2tlbjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIpOaWreWbnuiwg+aYr+WQpuS4uumUmeivr+Wbnuiwg++8jOW9k+WPkeeUn+mUmeivr+aXtiByZXN1bHQg5Li6IHVuZGVmaW5lZO+8jOWQpuWImSByZXN1bHQg5LiN5Li6IHVuZGVmaW5lZOOAglxyXG4gICAgICogQHBhcmFtIGVyciDplJnor6/miJYgbnVsbFxyXG4gICAgICogQHBhcmFtIHJlc3VsdCDlm57osIPnu5PmnpzlgLxcclxuICAgICAqIEByZXR1cm5zIOaYr+WQpuS4uumUmeivr+Wbnuiwg++8jOatpOaXtiByZXN1bHQg5Li6IHVuZGVmaW5lZOOAglxyXG4gICAgICovXHJcbiAgICAvLyBAdHMtaWdub3JlOiBlcnJvciBUUzYxMzM6ICdyZXN1bHQnIGlzIGRlY2xhcmVkIGJ1dCBpdHMgdmFsdWUgaXMgbmV2ZXIgcmVhZC5cclxuICAgIHByaXZhdGUgc3RhdGljIGhhc0Vycm9yKGVycjogRXJyb3IgfCBudWxsLCByZXN1bHQ6IGFueSk6IHJlc3VsdCBpcyB1bmRlZmluZWQge1xyXG4gICAgICAgIHJldHVybiAhIWVycjtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWtl+espuS4suWMluafpeivouWtl+espuS4slxyXG4gICAgICogQHBhcmFtIHF1ZXJ5IOafpeivouWtl+espuS4sumUruWAvOWvuVxyXG4gICAgICogQHJldHVybnMg5p+l6K+i5a2X56ym5LiyXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgc3RhdGljIHN0cmluZ2lmeVF1ZXJ5U3RyaW5nKHF1ZXJ5OiBNSC5RdWVyeSkge1xyXG4gICAgICAgIGNvbnN0IHF1ZXJ5TGlzdCA9IFtdO1xyXG4gICAgICAgIGZvciAoY29uc3QgbmFtZSBpbiBxdWVyeSkge1xyXG4gICAgICAgICAgICBsZXQgdmFsdWUgPSBxdWVyeVtuYW1lXTtcclxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xyXG4gICAgICAgICAgICAgICAgdmFsdWUgPSBbdmFsdWVdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3ViVmFsdWUgb2YgdmFsdWUpIHtcclxuICAgICAgICAgICAgICAgIGlmIChzdWJWYWx1ZSA9PT0gdm9pZCAwKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBpZiAoc3ViVmFsdWUgPT09ICcnKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcXVlcnlMaXN0LnB1c2goZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpKTtcclxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcXVlcnlMaXN0LnB1c2goYCR7ZW5jb2RlVVJJQ29tcG9uZW50KG5hbWUpfT0ke2VuY29kZVVSSUNvbXBvbmVudChTdHJpbmcoc3ViVmFsdWUpKX1gKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBxdWVyeVN0cmluZyA9IHF1ZXJ5TGlzdC5sZW5ndGggPyBxdWVyeUxpc3Quam9pbignJicpIDogJyc7XHJcbiAgICAgICAgcmV0dXJuIHF1ZXJ5U3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yik5pat5aqS6LWE5omY566h5ZCO56uv5pyN5Yqh6L+U5Zue55qE5pWw5o2u5piv5ZCm5Li65ZCO56uv6ZSZ6K+vXHJcbiAgICAgKiBAcGFyYW0gZGF0YSDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHov5Tlm57nmoTmlbDmja5cclxuICAgICAqIEByZXR1cm5zIOaYr+WQpuS4uuWQjuerr+mUmeivr1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBpc1JlbW90ZUVycm9yKGRhdGE6IGFueSk6IGRhdGEgaXMgTUguUmVtb3RlRXJyb3JEZXRhaWwge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGRhdGEuY29kZSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGRhdGEubWVzc2FnZSA9PT0gJ3N0cmluZyc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnvJbnoIHot6/lvoRcclxuICAgICAqIEBwYXJhbSBwYXRoIOWOn+Wni+i3r+W+hFxyXG4gICAgICogQHJldHVybnMg57yW56CB5ZCO5Y+v55u05o6l5ou85o6l5ZyoIFVSTCDkuK3nmoTot6/lvoRcclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgZW5jb2RlUGF0aChwYXRoOiBzdHJpbmcpIHtcclxuICAgICAgICByZXR1cm4gcGF0aC5zcGxpdCgnLycpLmZpbHRlcihuYW1lID0+IG5hbWUpLm1hcChuYW1lID0+IGVuY29kZVVSSUNvbXBvbmVudChuYW1lKSkuam9pbignLycpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgdXBkYXRlVG9rZW4odG9rZW4/OiBNSC5BY2Nlc3NUb2tlbiB8IG51bGwsIGNhbGxiYWNrPzogTUguR2V0QWNjZXNzVG9rZW5DYWxsYmFjaykge1xyXG4gICAgICAgIGlmICh0b2tlbiAmJiAoXHJcbiAgICAgICAgICAgIHR5cGVvZiB0b2tlbi5hY2Nlc3NUb2tlbiAhPT0gJ3N0cmluZycgfHwgIXRva2VuLmFjY2Vzc1Rva2VuIHx8XHJcbiAgICAgICAgICAgIHR5cGVvZiB0b2tlbi5leHBpcmVzSW4gIT09ICdudW1iZXInIHx8IHRva2VuLmV4cGlyZXNJbiA8PSAwXHJcbiAgICAgICAgKSkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguQmFzZUVycm9yKCdJbnZhbGlkIHRva2VuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodG9rZW4pIHtcclxuICAgICAgICAgICAgdGhpcy50b2tlbiA9IHRva2VuO1xyXG4gICAgICAgIH0gZWxzZSBpZiAodG9rZW4gPT09IG51bGwpIHtcclxuICAgICAgICAgICAgLy8gZm9yY2UgZW1wdHkgdG9rZW5cclxuICAgICAgICAgICAgdGhpcy50b2tlbiA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy50b2tlblRpbWVzdGFtcCA9IERhdGUubm93KCk7XHJcbiAgICAgICAgaWYgKHRoaXMudG9rZW5UaW1lcikge1xyXG4gICAgICAgICAgICBjbGVhclRpbWVvdXQodGhpcy50b2tlblRpbWVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHRoaXMudG9rZW4pIHtcclxuICAgICAgICAgICAgdGhpcy50b2tlblRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB0aGlzLmVuc3VyZVRva2VuKCksICh0aGlzLnRva2VuLmV4cGlyZXNJbiAtIE1JTl9QRVJJT0RfU0VDT05EUykgKiAxMDAwKTtcclxuICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCB0aGlzLnRva2VuKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliLfmlrDorr/pl67ku6TniYxcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDorr/pl67ku6TniYzliLfmlrDlrozmiJDlm57osIPvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/lkI7mnIDmlrDnmoTorr/pl67ku6TniYzkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgcmVmcmVzaFRva2VuKGNhbGxiYWNrPzogTUguR2V0QWNjZXNzVG9rZW5DYWxsYmFjaykge1xyXG4gICAgICAgIHRoaXMuZ2V0QWNjZXNzVG9rZW4oe1xyXG4gICAgICAgICAgICBsaWJyYXJ5SWQ6IHRoaXMubGlicmFyeUlkLFxyXG4gICAgICAgICAgICBzcGFjZUlkOiB0aGlzLnNwYWNlSWQsXHJcbiAgICAgICAgICAgIHVzZXJJZDogdGhpcy51c2VySWQsXHJcbiAgICAgICAgfSwgKGVyciwgdG9rZW4pID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgdG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4odG9rZW4sIGNhbGxiYWNrKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOehruS/neiuv+mXruS7pOeJjOWtmOWcqOS4lOWcqOacieaViOacn+WGhe+8jOWQpuWImeWwhuiHquWKqOe7reacn+aIluWIt+aWsOiuv+mXruS7pOeJjOOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuWcqOacieaViOacn+WGheeahOiuv+mXruS7pOeJjOOAglxyXG4gICAgICovXHJcbiAgICBlbnN1cmVUb2tlbihjYWxsYmFjaz86IE1ILkdldEFjY2Vzc1Rva2VuQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDnoa7kv53orr/pl67ku6TniYzlrZjlnKjkuJTlnKjmnInmlYjmnJ/lhoXvvIzlkKbliJnlsIboh6rliqjnu63mnJ/miJbliLfmlrDorr/pl67ku6TniYzjgIJcclxuICAgICAqIEBwYXJhbSBmb3JjZVJlbmV3IOaYr+WQpuW8uuWItue7reacn++8jOaMh+WumuS4uiB0cnVlIOaXtu+8jOWmguaenOiuv+mXruS7pOeJjOi3neemu+S4iuasoeS9v+eUqOW3sue7j+i2hei/hyA1IOWIhumSn++8jOWwhuiHquWKqOe7reacn++8m+WmguaenOiuv+mXruS7pOeJjOWJqeS9meacieaViOacn+S4jei2syA1IOWIhumSn++8jOWImeW/veeVpeivpeWPguaVsOW8uuWItuiHquWKqOe7reacn+OAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuespuWQiOimgeaxguacieaViOacn+eahOiuv+mXruS7pOeJjOOAglxyXG4gICAgICovXHJcbiAgICBlbnN1cmVUb2tlbihmb3JjZVJlbmV3PzogYm9vbGVhbiwgY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKTogdm9pZDtcclxuICAgIGVuc3VyZVRva2VuKGZvcmNlUmVuZXc/OiBib29sZWFuIHwgTUguR2V0QWNjZXNzVG9rZW5DYWxsYmFjaywgY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBmb3JjZVJlbmV3ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZm9yY2VSZW5ldztcclxuICAgICAgICAgICAgZm9yY2VSZW5ldyA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLnRva2VuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlZnJlc2hUb2tlbihjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHRva2VuID0gdGhpcy50b2tlbiE7XHJcbiAgICAgICAgY29uc3Qgc2luY2VMYXN0UmVmcmVzaCA9IE1hdGguZmxvb3IoKERhdGUubm93KCkgLSB0aGlzLnRva2VuVGltZXN0YW1wKSAvIDEwMDApO1xyXG4gICAgICAgIGlmICgoIWZvcmNlUmVuZXcgJiYgdGhpcy50b2tlbi5leHBpcmVzSW4gLSBzaW5jZUxhc3RSZWZyZXNoID4gTUlOX1BFUklPRF9TRUNPTkRTKVxyXG4gICAgICAgICAgICB8fCBzaW5jZUxhc3RSZWZyZXNoIDwgTUlOX1BFUklPRF9TRUNPTkRTKSB7XHJcbiAgICAgICAgICAgIC8vIOS4jemcgOimgeW8uuWItuWIt+aWsOS4lOacieaViOacn+i2hei/hzXliIbpkp/vvIzmiJbogIXpnIDopoHlvLrliLbliLfmlrDkvYbot53nprvkuIrmrKHliLfmlrDkuI3otrM15YiG6ZKf77yM55u05o6l6L+U5ZueXHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG51bGwsIHRva2VuKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd3gucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHVybDogYCR7VVJMX1BSRUZJWH0vdG9rZW4vJHt0aGlzLmxpYnJhcnlJZH0vJHt0b2tlbi5hY2Nlc3NUb2tlbn1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgc3VjY2VzczogKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoTUguaXNSZW1vdGVFcnJvcihkYXRhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLmNvZGUgPT09ICdJbnZhbGlkQWNjZXNzVG9rZW4nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOaXoOaViO+8jOebtOaOpeWIt+aWsFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZWZyZXNoVG9rZW4oY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyDlhbbku5bplJnor6/vvIzmipvlh7rljrtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUmVtb3RlRXJyb3IoZGF0YS5jb2RlLCBkYXRhLm1lc3NhZ2UpKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNvbnN0IHRva2VuID0gZGF0YSBhcyBNSC5BY2Nlc3NUb2tlbjtcclxuICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4odG9rZW4sIGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZmFpbDogKHJlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgLy8g6K+35rGC6ZSZ6K+v77yM5oqb5Ye65Y67XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBNSC5XeFJlcXVlc3RFcnJvcihyZXMuZXJyTXNnKSk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlkJHlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHlj5Hotbfor7fmsYJcclxuICAgICAqIEB0eXBlcGFyYW0gVCDlkI7nq6/mnI3liqHov5Tlm57miJDlip/ml7bnmoTmlbDmja7nsbvlnotcclxuICAgICAqIEBwYXJhbSBwYXJhbXMg6K+35rGC5Y+C5pWwXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg6K+35rGC5a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5ZCO5ZCO56uv5pyN5Yqh6L+U5Zue55qE5pWw5o2u44CCXHJcbiAgICAgKi9cclxuICAgIHByaXZhdGUgcmVxdWVzdDxUID0gJyc+KHBhcmFtczogTUguUmVxdWVzdFBhcmFtcywgY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2s8VD4pIHtcclxuICAgICAgICBjb25zdCB7IHN1YlVybCwgbWV0aG9kLCBxdWVyeSA9IHt9LCBkYXRhID0ge30gfSA9IHBhcmFtcztcclxuICAgICAgICBjb25zdCBpbm5lckNhbGxiYWNrOiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrID0gKGVyciwgdG9rZW4pID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgdG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHF1ZXJ5LmFjY2Vzc190b2tlbiA9IHRva2VuLmFjY2Vzc1Rva2VuO1xyXG4gICAgICAgICAgICB3eC5yZXF1ZXN0KHtcclxuICAgICAgICAgICAgICAgIHVybDogYCR7VVJMX1BSRUZJWH0ke3N1YlVybH0ke3N1YlVybC5pbmNsdWRlcygnPycpID8gJyYnIDogJz8nfSR7TUguc3RyaW5naWZ5UXVlcnlTdHJpbmcocXVlcnkpfWAsXHJcbiAgICAgICAgICAgICAgICBtZXRob2QsXHJcbiAgICAgICAgICAgICAgICBkYXRhLFxyXG4gICAgICAgICAgICAgICAgc3VjY2VzczogKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRhdGEgPSByZXN1bHQuZGF0YSBhcyBUO1xyXG4gICAgICAgICAgICAgICAgICAgIC8vIOWmguaenOi/lOWbnjIwNOmCo+S5iGRhdGHmmK/nqbrlrZfnrKbkuLJcclxuICAgICAgICAgICAgICAgICAgICBpZiAoTUguaXNSZW1vdGVFcnJvcihkYXRhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoZGF0YS5jb2RlID09PSAnSW52YWxpZEFjY2Vzc1Rva2VuJykge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy51cGRhdGVUb2tlbihudWxsKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmVuc3VyZVRva2VuKGlubmVyQ2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5SZW1vdGVFcnJvcihkYXRhLmNvZGUsIGRhdGEubWVzc2FnZSkpO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRva2VuKCk7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IHJlc3VsdC5zdGF0dXNDb2RlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBkYXRhLFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIGZhaWw6IChyZXMpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKG5ldyBNSC5XeFJlcXVlc3RFcnJvcihyZXMuZXJyTXNnKSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9KTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIHRoaXMuZW5zdXJlVG9rZW4oaW5uZXJDYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7rnp5/miLfnqbrpl7TjgILlnKjliJvlu7rmiJDlip/lkI7vvIzlvZPliY3lrp7kvovnmoTnp5/miLfnqbrpl7QgSUQg5bCG6Ieq5Yqo5oyH5ZCR5paw5Yib5bu655qE56ef5oi356m66Ze044CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Yib5bu65a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5Yib5bu655qE56ef5oi356m66Ze055qE55u45YWz5L+h5oGv44CCXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZVNwYWNlKGNhbGxiYWNrPzogTUguQ3JlYXRlU3BhY2VDYWxsYmFjayk6IHZvaWRcclxuICAgIC8qKlxyXG4gICAgICog5Yib5bu65YW35pyJ5oyH5a6a5omp5bGV6YCJ6aG555qE56ef5oi356m66Ze044CC5Zyo5Yib5bu65oiQ5Yqf5ZCO77yM5b2T5YmN5a6e5L6L55qE56ef5oi356m66Ze0IElEIOWwhuiHquWKqOaMh+WQkeaWsOWIm+W7uueahOenn+aIt+epuumXtOOAglxyXG4gICAgICogQHBhcmFtIGV4dGVuc2lvbiDnp5/miLfnqbrpl7TmianlsZXpgInpoblcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDliJvlu7rlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/liJvlu7rnmoTnp5/miLfnqbrpl7TnmoTnm7jlhbPkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgY3JlYXRlU3BhY2UoZXh0ZW5zaW9uPzogTUguU3BhY2VFeHRlbnNpb24sIGNhbGxiYWNrPzogTUguQ3JlYXRlU3BhY2VDYWxsYmFjayk6IHZvaWRcclxuICAgIGNyZWF0ZVNwYWNlKGV4dGVuc2lvbj86IE1ILlNwYWNlRXh0ZW5zaW9uIHwgTUguQ3JlYXRlU3BhY2VDYWxsYmFjaywgY2FsbGJhY2s/OiBNSC5DcmVhdGVTcGFjZUNhbGxiYWNrKSB7XHJcbiAgICAgICAgY29uc3QgcGFyYW1zOiBNSC5SZXF1ZXN0UGFyYW1zID0ge1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvc3BhY2UvJHt0aGlzLmxpYnJhcnlJZH1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICB9O1xyXG4gICAgICAgIGlmICh0eXBlb2YgZXh0ZW5zaW9uID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZXh0ZW5zaW9uO1xyXG4gICAgICAgICAgICBleHRlbnNpb24gPSB2b2lkIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChleHRlbnNpb24pIHtcclxuICAgICAgICAgICAgcGFyYW1zLmRhdGEgPSBleHRlbnNpb247XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdDxNSC5DcmVhdGVTcGFjZVJlc3VsdD4ocGFyYW1zLCAoZXJyLCByZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgcmVzdWx0KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnNwYWNlSWQgPSByZXN1bHQuZGF0YS5zcGFjZUlkO1xyXG4gICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAqIOS/ruaUueenn+aIt+epuumXtOeahOmDqOWIhuaJqeWxlemAiemhuVxyXG4gICAgKiBAcGFyYW0gZXh0ZW5zaW9uIOmcgOimgeS/ruaUueeahOaJqeWxlemAiemhue+8jOWPquaciemDqOWIhumAiemhueaUr+aMgeS/ruaUueS4lOS7heWcqOivpeWPguaVsOS4reWHuueOsOeahOmAiemhueS8muiiq+S/ruaUueOAglxyXG4gICAgKiBAcGFyYW0gY2FsbGJhY2sg5L+u5pS55a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf44CCXHJcbiAgICAqL1xyXG4gICAgdXBkYXRlU3BhY2VFeHRlbnNpb24oZXh0ZW5zaW9uOiBNSC5BbGxvd01vZGlmaWVkU3BhY2VFeHRlbnNpb24sIGNhbGxiYWNrPzogTUguUmVxdWVzdENhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICAgICAgc3ViVXJsOiBgL3NwYWNlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS9leHRlbnNpb25gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgZGF0YTogZXh0ZW5zaW9uLFxyXG4gICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIoOmZpOenn+aIt+epuumXtOOAguWcqOWIoOmZpOaIkOWKn+WQju+8jOW9k+WJjeWunuS+i+eahOenn+aIt+epuumXtCBJRCDlsIboh6rliqjnva7nqbrvvIzpnIDopoHph43mlrDliJvlu7rmlrDnmoTnp5/miLfnqbrpl7TmiJbmiYvliqjmjIflkJHlhbbku5bnmoTnp5/miLfnqbrpl7TjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDliKDpmaTlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/jgIJcclxuICAgICAqL1xyXG4gICAgZGVsZXRlU3BhY2UoY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvc3BhY2UvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9YCxcclxuICAgICAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcclxuICAgICAgICB9LCAoZXJyLCByZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgcmVzdWx0KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB0aGlzLnNwYWNlSWQgPSAnJztcclxuICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCByZXN1bHQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5YiG6aG15YiX5Ye65oyH5a6a55uu5b2V5Lit55qE5YaF5a65XHJcbiAgICAgKiBAcGFyYW0gcGFyYW1zIOWIhumhteWIl+WHuuebruW9leWPguaVsFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WIl+WHuueahOebruW9leWGheWuueS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICBsaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb24ocGFyYW1zOiBNSC5MaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25QYXJhbXMsIGNhbGxiYWNrPzogTUguTGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uQ2FsbGJhY2spIHtcclxuICAgICAgICBjb25zdCB7IHBhdGgsIG1hcmtlciwgbGltaXQgfSA9IHBhcmFtcztcclxuICAgICAgICB0aGlzLnJlcXVlc3Q8TGlzdERpcmVjdG9yeVJlc3VsdElubmVyPih7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9kaXJlY3RvcnkvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7cGF0aCA/IE1ILmVuY29kZVBhdGgocGF0aCkgOiAnJ31gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdHRVQnLFxyXG4gICAgICAgICAgICBxdWVyeTogeyBtYXJrZXIsIGxpbWl0IH0sXHJcbiAgICAgICAgfSwgKGVyciwgcmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgY29udGVudHM6IE1ILkRpcmVjdG9yeUNvbnRlbnRbXSA9IFtdO1xyXG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJlc3VsdC5kYXRhLmNvbnRlbnRzKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgY29udGVudHMucHVzaCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG5hbWU6IGl0ZW0ubmFtZSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgdHlwZTogaXRlbS50eXBlLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjcmVhdGlvblRpbWU6IG5ldyBEYXRlKGl0ZW0uY3JlYXRpb25UaW1lKSxcclxuICAgICAgICAgICAgICAgICAgICB9KTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwge1xyXG4gICAgICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IHJlc3VsdC5zdGF0dXNDb2RlLFxyXG4gICAgICAgICAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogcmVzdWx0LmRhdGEucGF0aCxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmV4dE1hcmtlcjogcmVzdWx0LmRhdGEubmV4dE1hcmtlcixcclxuICAgICAgICAgICAgICAgICAgICAgICAgY29udGVudHMsXHJcbiAgICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJflh7rmoLnnm67lvZXkuK3nmoTlhoXlrrnvvIzor6Xmlrnms5XlsIboh6rliqjku47nrKwgMSDpobXlvIDlp4vliJflh7rmoLnnm67lvZXnm7TliLDmiYDmnInpobXlnYfliJflh7rjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/liJflh7rnmoTnm67lvZXlhoXlrrnkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgbGlzdERpcmVjdG9yeShjYWxsYmFjaz86IE1ILkxpc3REaXJlY3RvcnlDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOWIl+WHuuaMh+WumuebruW9leS4reeahOWGheWuue+8jOivpeaWueazleWwhuiHquWKqOS7juesrCAxIOmhteW8gOWni+WIl+WHuuaMh+WumuebruW9leebtOWIsOaJgOaciemhteWdh+WIl+WHuuOAglxyXG4gICAgICogQHBhcmFtIHBhdGgg55uu5b2V6Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5YiX5Ye655qE55uu5b2V5YaF5a655L+h5oGv44CCXHJcbiAgICAgKi9cclxuICAgIGxpc3REaXJlY3RvcnkocGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILkxpc3REaXJlY3RvcnlDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICBsaXN0RGlyZWN0b3J5KHBhdGg/OiBzdHJpbmcgfCBNSC5MaXN0RGlyZWN0b3J5Q2FsbGJhY2ssIGNhbGxiYWNrPzogTUguTGlzdERpcmVjdG9yeUNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBwYXRoID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrID0gcGF0aDtcclxuICAgICAgICAgICAgcGF0aCA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgaW5uZXJQYXRoID0gcGF0aCB8fCAnJztcclxuICAgICAgICBsZXQgcmV0dXJuUGF0aDogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBsZXQgY29udGVudHM6IE1ILkRpcmVjdG9yeUNvbnRlbnRbXSA9IFtdO1xyXG4gICAgICAgIGxldCBtYXJrZXI6IG51bWJlciB8IHVuZGVmaW5lZCA9IHZvaWQgMDtcclxuICAgICAgICBsZXQgcmV0cmllZFRpbWVzID0gMDtcclxuICAgICAgICBsZXQgaW5uZXJDYWxsYmFjazogTUguTGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uQ2FsbGJhY2sgPSAoZXJyLCByZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgcmVzdWx0KSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHJldHJpZWRUaW1lcyA+PSAyKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIHJldHJpZWRUaW1lcysrO1xyXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHJlc3VsdCkge1xyXG4gICAgICAgICAgICAgICAgcmV0cmllZFRpbWVzID0gMDtcclxuICAgICAgICAgICAgICAgIHJldHVyblBhdGggPSByZXN1bHQuZGF0YS5wYXRoO1xyXG4gICAgICAgICAgICAgICAgY29udGVudHMgPSBjb250ZW50cy5jb25jYXQocmVzdWx0LmRhdGEuY29udGVudHMpO1xyXG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5kYXRhLm5leHRNYXJrZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICBtYXJrZXIgPSByZXN1bHQuZGF0YS5uZXh0TWFya2VyO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihudWxsLCB7IHBhdGg6IHJldHVyblBhdGgsIGNvbnRlbnRzIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMubGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uKHsgcGF0aDogaW5uZXJQYXRoLCBtYXJrZXIgfSwgaW5uZXJDYWxsYmFjayk7XHJcbiAgICAgICAgfTtcclxuICAgICAgICBpbm5lckNhbGxiYWNrKG51bGwpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yib5bu655uu5b2VXHJcbiAgICAgKiBAcGFyYW0gcGF0aCDnm67lvZXot6/lvoRcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDliJvlu7rlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/jgIJcclxuICAgICAqL1xyXG4gICAgY3JlYXRlRGlyZWN0b3J5KHBhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoIXBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIHBhdGggaXMgZW1wdHkuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvZGlyZWN0b3J5LyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgocGF0aCl9YCxcclxuICAgICAgICAgICAgbWV0aG9kOiAnUFVUJyxcclxuICAgICAgICB9LCBjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliKDpmaTmjIflrprnm67lvZVcclxuICAgICAqIEBwYXJhbSBwYXRoIOebruW9lei3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWIoOmZpOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+OAglxyXG4gICAgICovXHJcbiAgICBkZWxldGVEaXJlY3RvcnkocGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILlJlcXVlc3RDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICghcGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gcGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9kaXJlY3RvcnkvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7TUguZW5jb2RlUGF0aChwYXRoKX1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxyXG4gICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmHjeWRveWQjeaIluenu+WKqOaMh+WumuebruW9lVxyXG4gICAgICogQHBhcmFtIGZyb21QYXRoIOa6kOebruW9leWujOaVtOi3r+W+hFxyXG4gICAgICogQHBhcmFtIHRvUGF0aCDnm67moIfnm67lvZXlrozmlbTot6/lvoRcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDph43lkb3lkI3miJbnp7vliqjlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/jgIJcclxuICAgICAqL1xyXG4gICAgbW92ZURpcmVjdG9yeShmcm9tUGF0aDogc3RyaW5nLCB0b1BhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoIWZyb21QYXRoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5QYXJhbUVycm9yKCdQYXJhbSBmcm9tUGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghdG9QYXRoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5QYXJhbUVycm9yKCdQYXJhbSB0b1BhdGggaXMgZW1wdHkuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvZGlyZWN0b3J5LyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgodG9QYXRoKX1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgICAgICBkYXRhOiB7XHJcbiAgICAgICAgICAgICAgICBmcm9tOiBmcm9tUGF0aFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluWqkuS9k+W6k+aMh+WumuebuOewv+eahOWwgemdouWbvueJhyBVUkxcclxuICAgICAqIEBwYXJhbSBhbGJ1bU5hbWUg55u457C/5ZCN77yM5a+55LqO6Z2e5aSa55u457C/5qih5byP5Y+v5oyH5a6a56m65a2X56ym5Liy6I635Y+W5pW05Liq56m66Ze055qE5bCB6Z2i5Zu+44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE55u457C/5bCB6Z2i5Zu+54mHIFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRDb3ZlclVybChhbGJ1bU5hbWU6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluWqkuS9k+W6k+aMh+WumuebuOewv+eahOaMh+WumuWkp+Wwj+eahOWwgemdouWbvueJhyBVUkxcclxuICAgICAqIEBwYXJhbSBhbGJ1bU5hbWUg55u457C/5ZCN77yM5a+55LqO6Z2e5aSa55u457C/5qih5byP5Y+v5oyH5a6a56m65a2X56ym5Liy6I635Y+W5pW05Liq56m66Ze055qE5bCB6Z2i5Zu+44CCXHJcbiAgICAgKiBAcGFyYW0gc2l6ZSDlsIHpnaLlm77niYflpKflsI8ocHgp77yM5bCG57yp5pS+6KOB5Ymq5Li65q2j5pa55b2i5Zu+54mH44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE55u457C/5bCB6Z2i5Zu+54mHIFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRDb3ZlclVybChhbGJ1bU5hbWU6IHN0cmluZywgc2l6ZTogbnVtYmVyLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog5om56YeP6I635Y+W5aqS5L2T5bqT5oyH5a6a55u457C/55qE5bCB6Z2i5Zu+54mHIFVSTFxyXG4gICAgICogQHBhcmFtIGFsYnVtTmFtZUxpc3Qg55u457C/5ZCN5YiX6KGo77yM5a+55LqO6Z2e5aSa55u457C/5qih5byP5Y+v5oyH5a6a56m65a2X56ym5Liy6I635Y+W5pW05Liq56m66Ze055qE5bCB6Z2i5Zu+44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE55u457C/5bCB6Z2i5Zu+54mHIFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRDb3ZlclVybChhbGJ1bU5hbWVMaXN0OiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOaJuemHj+iOt+WPluWqkuS9k+W6k+aMh+WumuebuOewv+eahOaMh+WumuWkp+Wwj+eahOWwgemdouWbvueJhyBVUkxcclxuICAgICAqIEBwYXJhbSBhbGJ1bU5hbWVMaXN0IOebuOewv+WQjeWIl+ihqO+8jOWvueS6jumdnuWkmuebuOewv+aooeW8j+WPr+aMh+WumuepuuWtl+espuS4suiOt+WPluaVtOS4quepuumXtOeahOWwgemdouWbvuOAglxyXG4gICAgICogQHBhcmFtIHNpemUg5bCB6Z2i5Zu+54mH5aSn5bCPKHB4Ke+8jOWwhue8qeaUvuijgeWJquS4uuato+aWueW9ouWbvueJh+OAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOebuOewv+WwgemdouWbvueJhyBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0Q292ZXJVcmwoYWxidW1OYW1lTGlzdDogc3RyaW5nW10sIHNpemU6IG51bWJlciwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICBnZXRDb3ZlclVybChhbGJ1bU5hbWVMaXN0OiBzdHJpbmcgfCBzdHJpbmdbXSwgc2l6ZT86IG51bWJlciB8IE1ILkdldFVybENhbGxiYWNrLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy5lbnN1cmVUb2tlbih0cnVlLCAoZXJyLCB0b2tlbikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCB0b2tlbikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KGFsYnVtTmFtZUxpc3QpKSB7XHJcbiAgICAgICAgICAgICAgICBhbGJ1bU5hbWVMaXN0ID0gW2FsYnVtTmFtZUxpc3RdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2l6ZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2sgPSBzaXplO1xyXG4gICAgICAgICAgICAgICAgc2l6ZSA9IHZvaWQgMDtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBxdWVyeTogTUguUXVlcnkgPSB7XHJcbiAgICAgICAgICAgICAgICBhY2Nlc3NfdG9rZW46IHRva2VuLmFjY2Vzc1Rva2VuLFxyXG4gICAgICAgICAgICAgICAgc2l6ZSxcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgY29uc3QgdXJscyA9IGFsYnVtTmFtZUxpc3QubWFwKGFsYnVtTmFtZSA9PiBgJHtVUkxfUFJFRklYfS9hbGJ1bS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vY292ZXIke2FsYnVtTmFtZSA/ICcvJyArIE1ILmVuY29kZVBhdGgoYWxidW1OYW1lKSA6ICcnfT8ke01ILnN0cmluZ2lmeVF1ZXJ5U3RyaW5nKHF1ZXJ5KX1gKTtcclxuICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCB1cmxzKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICBwcml2YXRlIGdldEZpbGVVcmxXaXRoUXVlcnkocGF0aExpc3Q6IHN0cmluZyB8IHN0cmluZ1tdLCBxdWVyeTogTUguUXVlcnksIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIHBhdGhMaXN0ID09PSAnc3RyaW5nJyAmJiAhcGF0aExpc3QgfHwgQXJyYXkuaXNBcnJheShwYXRoTGlzdCkgJiYgIXBhdGhMaXN0Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gcGF0aC9wYXRoTGlzdCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuZW5zdXJlVG9rZW4odHJ1ZSwgKGVyciwgdG9rZW4pID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgdG9rZW4pKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICghQXJyYXkuaXNBcnJheShwYXRoTGlzdCkpIHtcclxuICAgICAgICAgICAgICAgIHBhdGhMaXN0ID0gW3BhdGhMaXN0XTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCB1cmxzID0gcGF0aExpc3QubWFwKHBhdGggPT4gYCR7VVJMX1BSRUZJWH0vZmlsZS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vJHtNSC5lbmNvZGVQYXRoKHBhdGgpfT8ke01ILnN0cmluZ2lmeVF1ZXJ5U3RyaW5nKHtcclxuICAgICAgICAgICAgICAgIC4uLnF1ZXJ5LFxyXG4gICAgICAgICAgICAgICAgYWNjZXNzX3Rva2VuOiB0b2tlbi5hY2Nlc3NUb2tlbixcclxuICAgICAgICAgICAgfSl9YCk7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwgdXJscyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bmjIflrprmlofku7YgVVJMXHJcbiAgICAgKiBAcGFyYW0gcGF0aCDmlofku7bot6/lvoRcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTmlofku7YgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldEZpbGVVcmwocGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog5om56YeP6I635Y+W5oyH5a6a5paH5Lu2IFVSTFxyXG4gICAgICogQHBhcmFtIHBhdGhMaXN0IOaWh+S7tui3r+W+hOWIl+ihqFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0RmlsZVVybChwYXRoTGlzdDogc3RyaW5nW10sIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgZ2V0RmlsZVVybChwYXRoTGlzdDogc3RyaW5nIHwgc3RyaW5nW10sIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLmdldEZpbGVVcmxXaXRoUXVlcnkocGF0aExpc3QsIHt9LCBjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bmjIflrprnhafniYcgVVJMIOaIluinhumikeeahOWwgemdoiBVUkxcclxuICAgICAqIEBwYXJhbSBwYXRoIOaWh+S7tui3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0UHJldmlld1VybChwYXRoOiBzdHJpbmcsIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDojrflj5bmjIflrprlqpLkvZPmlofku7bnmoTmjIflrprlpKflsI/nmoTnvKnnlaXlm74gVVJMXHJcbiAgICAgKiBAcGFyYW0gcGF0aCDmlofku7bot6/lvoRcclxuICAgICAqIEBwYXJhbSBzaXplIOe8qeeVpeWbvuWkp+WwjyhweCnvvIzlsIbnvKnmlL7oo4HliarkuLrmraPmlrnlvaLlm77niYfjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTmlofku7YgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldFByZXZpZXdVcmwocGF0aDogc3RyaW5nLCBzaXplOiBudW1iZXIsIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDmibnph4/ojrflj5bmjIflrprnhafniYcgVVJMIOaIluinhumikeeahOWwgemdoiBVUkxcclxuICAgICAqIEBwYXJhbSBwYXRoTGlzdCDmlofku7bot6/lvoTliJfooahcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTmlofku7YgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldFByZXZpZXdVcmwocGF0aExpc3Q6IHN0cmluZ1tdLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog5om56YeP6I635Y+W5oyH5a6a5aqS5L2T5paH5Lu255qE5oyH5a6a5aSn5bCP55qE57yp55Wl5Zu+IFVSTFxyXG4gICAgICogQHBhcmFtIHBhdGhMaXN0IOaWh+S7tui3r+W+hOWIl+ihqFxyXG4gICAgICogQHBhcmFtIHNpemUg57yp55Wl5Zu+5aSn5bCPKHB4Ke+8jOWwhue8qeaUvuijgeWJquS4uuato+aWueW9ouWbvueJh+OAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0UHJldmlld1VybChwYXRoTGlzdDogc3RyaW5nW10sIHNpemU6IG51bWJlciwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICBnZXRQcmV2aWV3VXJsKHBhdGhMaXN0OiBzdHJpbmcgfCBzdHJpbmdbXSwgc2l6ZT86IG51bWJlciB8IE1ILkdldFVybENhbGxiYWNrLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBzaXplID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrID0gc2l6ZTtcclxuICAgICAgICAgICAgc2l6ZSA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5nZXRGaWxlVXJsV2l0aFF1ZXJ5KHBhdGhMaXN0LCB7XHJcbiAgICAgICAgICAgIHByZXZpZXc6ICcnLFxyXG4gICAgICAgICAgICBzaXplLFxyXG4gICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOS4iuS8oOaWh+S7tlxyXG4gICAgICogQHBhcmFtIHJlbW90ZVBhdGgg5paH5Lu255qE6L+c56iL55uu5qCH6Lev5b6E77yM5aaC5p6c5oyH5a6a6Lev5b6E5a2Y5Zyo5ZCM5ZCN5paH5Lu25oiW55uu5b2V5YiZ6Ieq5Yqo5pS55ZCN44CCXHJcbiAgICAgKiBAcGFyYW0gbG9jYWxQYXRoIOWcqOW+ruS/oeWGheiOt+WPlueahOaWh+S7tuacrOWcsOi3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOS4iuS8oOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+S4iuS8oOeahOaWh+S7tueahOS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICB1cGxvYWRGaWxlKHJlbW90ZVBhdGg6IHN0cmluZywgbG9jYWxQYXRoOiBzdHJpbmcsIGNhbGxiYWNrPzogTUguVXBsb2FkQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDkuIrkvKDmlofku7blubblj6/mjIflrprpgYfliLDlkIzlkI3mlofku7bmiJbnm67lvZXml7bnmoTlpITnkIbmlrnms5VcclxuICAgICAqIEBwYXJhbSByZW1vdGVQYXRoIOaWh+S7tueahOi/nOeoi+ebruagh+i3r+W+hFxyXG4gICAgICogQHBhcmFtIGxvY2FsUGF0aCDlnKjlvq7kv6HlhoXojrflj5bnmoTmlofku7bmnKzlnLDot6/lvoRcclxuICAgICAqIEBwYXJhbSBmb3JjZSDmmK/lkKblvLrliLbopobnm5blkIzlkI3mlofku7bmiJbnm67lvZXvvIzlvZPpgInmi6nlvLrliLbopobnm5bml7bvvIzlkIzlkI3mlofku7blsIbkvJrooqvliKDpmaTvvIzlkIzlkI3nm67lvZXlsIbkvJrov57lkIznm67lvZXlhoXlrrnkuIDlubbooqvliKDpmaTjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDkuIrkvKDlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/kuIrkvKDnmoTmlofku7bnmoTkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgdXBsb2FkRmlsZShyZW1vdGVQYXRoOiBzdHJpbmcsIGxvY2FsUGF0aDogc3RyaW5nLCBmb3JjZTogYm9vbGVhbiwgY2FsbGJhY2s/OiBNSC5VcGxvYWRDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICB1cGxvYWRGaWxlKHJlbW90ZVBhdGg6IHN0cmluZywgbG9jYWxQYXRoOiBzdHJpbmcsIGZvcmNlPzogYm9vbGVhbiB8IE1ILlVwbG9hZENhbGxiYWNrLCBjYWxsYmFjaz86IE1ILlVwbG9hZENhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKCFyZW1vdGVQYXRoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5QYXJhbUVycm9yKCdQYXJhbSByZW1vdGVQYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCFsb2NhbFBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIGxvY2FsUGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZm9yY2UgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sgPSBmb3JjZTtcclxuICAgICAgICAgICAgZm9yY2UgPSB2b2lkIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdDxNSC5CZWdpblVwbG9hZFJlc3VsdD4oe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvZmlsZS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vJHtNSC5lbmNvZGVQYXRoKHJlbW90ZVBhdGgpfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgICAgICBxdWVyeToge1xyXG4gICAgICAgICAgICAgICAgZm9yY2U6IGZvcmNlID8gMSA6IDAsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSwgKGVyciwgcmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHJlc3VsdCkpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXN1bHQ7XHJcbiAgICAgICAgICAgIGNvbnN0IHsgZG9tYWluLCBmb3JtLCBjb25maXJtS2V5IH0gPSBkYXRhO1xyXG4gICAgICAgICAgICB3eC51cGxvYWRGaWxlKHtcclxuICAgICAgICAgICAgICAgIHVybDogYGh0dHBzOi8vJHtkb21haW59L2AsXHJcbiAgICAgICAgICAgICAgICBmaWxlUGF0aDogbG9jYWxQYXRoLFxyXG4gICAgICAgICAgICAgICAgbmFtZTogJ2ZpbGUnLFxyXG4gICAgICAgICAgICAgICAgZm9ybURhdGE6IGZvcm0sXHJcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiAocmVzdWx0KSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5zdGF0dXNDb2RlICE9PSAyMDQpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILkNvc0Vycm9yKHJlc3VsdC5kYXRhKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIHN1YlVybDogYC9maWxlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke2NvbmZpcm1LZXl9P2NvbmZpcm1gLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgICAgICAgICB9LCBjYWxsYmFjayk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZmFpbDogKHJlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IE1ILld4UmVxdWVzdEVycm9yKHJlcy5lcnJNc2cpKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pXHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliKDpmaTmjIflrprmlofku7ZcclxuICAgICAqIEBwYXJhbSBwYXRoIOaWh+S7tui3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWIoOmZpOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+OAglxyXG4gICAgICovXHJcbiAgICBkZWxldGVGaWxlKHBhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoIXBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIHBhdGggaXMgZW1wdHkuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvZmlsZS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vJHtNSC5lbmNvZGVQYXRoKHBhdGgpfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURScsXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6YeN5ZG95ZCN5oiW56e75Yqo5oyH5a6a5paH5Lu2XHJcbiAgICAgKiBAcGFyYW0gZnJvbVBhdGgg5rqQ5paH5Lu25a6M5pW06Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gdG9QYXRoIOebruagh+aWh+S7tuWujOaVtOi3r+W+hO+8jOWmguaenOaMh+Wumui3r+W+hOWtmOWcqOWQjOWQjeaWh+S7tuaIluebruW9leWImeiHquWKqOaUueWQjeOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOmHjeWRveWQjeaIluenu+WKqOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+mHjeWRveWQjeaIluenu+WKqOeahOebruagh+aWh+S7tuS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICBtb3ZlRmlsZShmcm9tUGF0aDogc3RyaW5nLCB0b1BhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5VcGxvYWRDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOmHjeWRveWQjeaIluenu+WKqOaMh+WumuaWh+S7tuW5tuWPr+aMh+WumumBh+WIsOWQjOWQjeaWh+S7tuaIluebruW9leaXtueahOWkhOeQhuaWueazlVxyXG4gICAgICogQHBhcmFtIGZyb21QYXRoIOa6kOaWh+S7tuWujOaVtOi3r+W+hFxyXG4gICAgICogQHBhcmFtIHRvUGF0aCDnm67moIfmlofku7blrozmlbTot6/lvoRcclxuICAgICAqIEBwYXJhbSBmb3JjZSDmmK/lkKblvLrliLbopobnm5blkIzlkI3mlofku7bmiJbnm67lvZXvvIzlvZPpgInmi6nlvLrliLbopobnm5bml7bvvIzlkIzlkI3mlofku7blsIbkvJrooqvliKDpmaTvvIzlkIzlkI3nm67lvZXlsIbkvJrov57lkIznm67lvZXlhoXlrrnkuIDlubbooqvliKDpmaTjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDph43lkb3lkI3miJbnp7vliqjlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ph43lkb3lkI3miJbnp7vliqjnmoTnm67moIfmlofku7bkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgbW92ZUZpbGUoZnJvbVBhdGg6IHN0cmluZywgdG9QYXRoOiBzdHJpbmcsIGZvcmNlOiBib29sZWFuLCBjYWxsYmFjaz86IE1ILlVwbG9hZENhbGxiYWNrKTogdm9pZDtcclxuICAgIG1vdmVGaWxlKGZyb21QYXRoOiBzdHJpbmcsIHRvUGF0aDogc3RyaW5nLCBmb3JjZT86IGJvb2xlYW4gfCBNSC5VcGxvYWRDYWxsYmFjaywgY2FsbGJhY2s/OiBNSC5VcGxvYWRDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICghZnJvbVBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIGZyb21QYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0b1BhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIHRvUGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0eXBlb2YgZm9yY2UgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sgPSBmb3JjZTtcclxuICAgICAgICAgICAgZm9yY2UgPSB2b2lkIDA7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9maWxlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgodG9QYXRoKX1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgICAgICBxdWVyeToge1xyXG4gICAgICAgICAgICAgICAgZm9yY2U6IGZvcmNlID8gMSA6IDAsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgIGZyb206IGZyb21QYXRoXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG59XHJcblxyXG5uYW1lc3BhY2UgTUgge1xyXG5cclxuICAgIC8qKiDlnKggRVM1IOS4i+S/ruWkjeS6huWOn+Wei+mTvueahOmUmeivr+WfuuexuyAqL1xyXG4gICAgZXhwb3J0IGNsYXNzIEJhc2VFcnJvciBleHRlbmRzIEVycm9yIHtcclxuICAgICAgICBjb25zdHJ1Y3RvcihtZXNzYWdlOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICAgICAgICAgIHRoaXMubmFtZSA9IG5ldy50YXJnZXQubmFtZTtcclxuICAgICAgICAgICAgY29uc3QgeyBjYXB0dXJlU3RhY2tUcmFjZSB9ID0gRXJyb3IgYXMgYW55O1xyXG4gICAgICAgICAgICBpZiAodHlwZW9mIGNhcHR1cmVTdGFja1RyYWNlID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBjYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBuZXcudGFyZ2V0KTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAodHlwZW9mIE9iamVjdC5zZXRQcm90b3R5cGVPZiA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICAgICAgT2JqZWN0LnNldFByb3RvdHlwZU9mKHRoaXMsIG5ldy50YXJnZXQucHJvdG90eXBlKTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICh0aGlzIGFzIGFueSkuX19wcm90b19fID0gbmV3LnRhcmdldC5wcm90b3R5cGU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoq5Y+C5pWw6ZSZ6K+vICovXHJcbiAgICBleHBvcnQgY2xhc3MgUGFyYW1FcnJvciBleHRlbmRzIEJhc2VFcnJvciB7IH1cclxuXHJcbiAgICAvKiog6YCa6L+H5b6u5L+h5o6l5Y+j5Y+R6LW36K+35rGC5pe25Y+R55Sf6ZSZ6K+vICovXHJcbiAgICBleHBvcnQgY2xhc3MgV3hSZXF1ZXN0RXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3IgeyB9XHJcblxyXG4gICAgLyoqIOWqkui1hOaJmOeuoeWQjuerr+acjeWKoemUmeivryAqL1xyXG4gICAgZXhwb3J0IGNsYXNzIFJlbW90ZUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHtcclxuXHJcbiAgICAgICAgLyoqIOmUmeivr+eggSAqL1xyXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBjb2RlOiBzdHJpbmc7XHJcblxyXG4gICAgICAgIC8qKiBcclxuICAgICAgICAgKiDlrp7kvovljJblqpLotYTmiZjnrqHlkI7nq6/mnI3liqHplJnor69cclxuICAgICAgICAgKiBAcGFyYW0gY29kZSDplJnor6/noIFcclxuICAgICAgICAgKiBAcGFyYW0gbWVzc2FnZSDplJnor6/kv6Hmga9cclxuICAgICAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICAgICAqL1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKGNvZGU6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKSB7XHJcbiAgICAgICAgICAgIHN1cGVyKG1lc3NhZ2UpO1xyXG4gICAgICAgICAgICB0aGlzLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKiog5a+56LGh5a2Y5YKo5ZCO56uv5pyN5Yqh6ZSZ6K+vICovXHJcbiAgICBleHBvcnQgY2xhc3MgQ29zRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xyXG5cclxuICAgICAgICAvKiog6ZSZ6K+v56CBICovXHJcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGNvZGU6IHN0cmluZztcclxuICAgICAgICAvKiog6K+35rGCIElEICovXHJcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IHJlcXVlc3RJZDogc3RyaW5nO1xyXG5cclxuICAgICAgICAvKiogXHJcbiAgICAgICAgICog5a6e5L6L5YyW5a+56LGh5a2Y5YKo5ZCO56uv5pyN5Yqh6ZSZ6K+vXHJcbiAgICAgICAgICogQHBhcmFtIGVycm9yWG1sIOWvueixoeWtmOWCqOWQjuerr+acjeWKoei/lOWbnueahOWMheWQq+mUmeivr+S/oeaBr+eahCBYTUwg5a2X56ym5LiyXHJcbiAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25zdHJ1Y3RvcihlcnJvclhtbDogc3RyaW5nID0gJycpIHtcclxuICAgICAgICAgICAgY29uc3QgY29kZSA9IC88Q29kZT4oW148XSspPFxcL0NvZGU+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IC88TWVzc2FnZT4oW148XSspPFxcL01lc3NhZ2U+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgY29uc3QgcmVxdWVzdElkID0gLzxSZXF1ZXN0SWQ+KFtePF0rKTxcXC9SZXF1ZXN0SWQ+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29kZSA9IGNvZGU7XHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdElkID0gcmVxdWVzdElkO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmAmueUqOWbnuiwg+aWueazlVxyXG4gICAgICogQHR5cGVwYXJhbSBUIOaIkOWKn+Wbnuiwg+aXtueahOWbnuiwg+WAvOeahOexu+Wei1xyXG4gICAgICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEdlbmVyYWxDYWxsYmFjazxUPiB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHBhcmFtIGVyciDplJnor6/miJYgbnVsbO+8jOW9k+S4uiBudWxsIOaXtuS7o+ihqOaIkOWKn+Wbnuiwg+OAglxyXG4gICAgICAgICAqIEBwYXJhbSByZXN1bHQg5oiQ5Yqf5Zue6LCD5pe255qE5Zue6LCD5YC8XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgKGVycjogRXJyb3IgfCBudWxsLCByZXN1bHQ/OiBUKTogdm9pZDtcclxuICAgIH1cclxuXHJcbiAgICAvKiog6K6/6Zeu5Luk54mM5L+h5oGvICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEFjY2Vzc1Rva2VuIHtcclxuICAgICAgICAvKiog6K6/6Zeu5Luk54mMICovXHJcbiAgICAgICAgYWNjZXNzVG9rZW46IHN0cmluZztcclxuICAgICAgICAvKiog5pyJ5pWI5pe26ZW/77yI5Y2V5L2N77ya56eS77yJICovXHJcbiAgICAgICAgZXhwaXJlc0luOiBudW1iZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWujOaIkOiOt+WPluiuv+mXruS7pOeJjOWHveaVsOeahOWbnuiwg+WHveaVsO+8jOWcqOS4muWKoeaWueWujOaIkOS7pOeJjOiOt+WPluWQjuiwg+eUqOivpeWbnuiwg+WHveaVsOWwhuS7pOeJjOS/oeaBr+i/lOWbnue7meWqkuS9k+aJmOeuoeWuouaIt+err+OAgiAqL1xyXG4gICAgZXhwb3J0IHR5cGUgR2V0QWNjZXNzVG9rZW5DYWxsYmFjayA9IEdlbmVyYWxDYWxsYmFjazxBY2Nlc3NUb2tlbj47XHJcblxyXG4gICAgLyoqIOiOt+WPluiuv+mXruS7pOeJjOWHveaVsOeahOWPguaVsCAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBHZXRBY2Nlc3NUb2tlbkZ1bmNQYXJhbXMge1xyXG4gICAgICAgIC8qKiDlqpLkvZPlupMgSUQgKi9cclxuICAgICAgICBsaWJyYXJ5SWQ6IHN0cmluZztcclxuICAgICAgICAvKiog56ef5oi356m66Ze0IElEICovXHJcbiAgICAgICAgc3BhY2VJZDogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDnlKjmiLcgSUQgKi9cclxuICAgICAgICB1c2VySWQ6IHN0cmluZztcclxuICAgIH1cclxuXHJcbiAgICAvKiog6I635Y+W6K6/6Zeu5Luk54mM5Ye95pWwICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEdldEFjY2Vzc1Rva2VuRnVuYyB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHBhcmFtIHBhcmFtcyDojrflj5borr/pl67ku6TniYzlh73mlbDnmoTlj4LmlbBcclxuICAgICAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM5Zyo5Lia5Yqh5pa55a6M5oiQ5Luk54mM6I635Y+W5ZCO6LCD55So6K+l5Zue6LCD5Ye95pWw5bCG5Luk54mM5L+h5oGv6L+U5Zue57uZ5aqS5L2T5omY566h5a6i5oi356uvXHJcbiAgICAgICAgICovXHJcbiAgICAgICAgKHBhcmFtczogR2V0QWNjZXNzVG9rZW5GdW5jUGFyYW1zLCBjYWxsYmFjazogR2V0QWNjZXNzVG9rZW5DYWxsYmFjayk6IHZvaWQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWunuS+i+WMluWqkui1hOaJmOeuoeWuouaIt+err+eahOWPguaVsCAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBDb25zdHJ1Y3RvclBhcmFtcyB7XHJcbiAgICAgICAgLyoqIOWqkuS9k+W6kyBJRCAqL1xyXG4gICAgICAgIGxpYnJhcnlJZDogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDnp5/miLfnqbrpl7QgSUQgKi9cclxuICAgICAgICBzcGFjZUlkPzogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDnlKjmiLcgSUQgKi9cclxuICAgICAgICB1c2VySWQ/OiBzdHJpbmc7XHJcblxyXG4gICAgICAgIC8qKiDojrflj5borr/pl67ku6TniYzlh73mlbDvvIzlqpLotYTmiZjnrqHlrqLmiLfnq6/lsIblnKjpnIDopoHojrflj5borr/pl67ku6TniYzml7bosIPnlKjor6Xlh73mlbDvvIzkvKDlhaXnm7jlhbPlj4LmlbDlkozlm57osIPlh73mlbDvvIzlnKjkuJrliqHmlrnlrozmiJDku6TniYzojrflj5blkI7osIPnlKjlm57osIPlh73mlbDov5Tlm57ku6TniYzkv6Hmga/jgIIgKi9cclxuICAgICAgICBnZXRBY2Nlc3NUb2tlbjogR2V0QWNjZXNzVG9rZW5GdW5jO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDmn6Xor6LlrZfnrKbkuLLnu5PmnoQgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgUXVlcnkge1xyXG4gICAgICAgIC8qKiDplK7lgLzlr7kgKi9cclxuICAgICAgICBbbmFtZTogc3RyaW5nXTogdW5kZWZpbmVkIHwgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbiB8ICh1bmRlZmluZWQgfCBzdHJpbmcgfCBudW1iZXIgfCBib29sZWFuKVtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDor7fmsYLlj4LmlbAgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgUmVxdWVzdFBhcmFtcyB7XHJcbiAgICAgICAgLyoqIOivt+axgiBVUkwg6Zmk5Y675YmN57yA55qE6YOo5YiGICovXHJcbiAgICAgICAgc3ViVXJsOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOivt+axguaWueazlSAqL1xyXG4gICAgICAgIG1ldGhvZDogJ0dFVCcgfCAnSEVBRCcgfCAnUE9TVCcgfCAnUFVUJyB8ICdERUxFVEUnO1xyXG4gICAgICAgIC8qKiDor7fmsYLmn6Xor6LlrZfnrKbkuLLnu5PmnoQgKi9cclxuICAgICAgICBxdWVyeT86IFF1ZXJ5O1xyXG4gICAgICAgIC8qKiDor7fmsYLkvZPmlbDmja4gKi9cclxuICAgICAgICBkYXRhPzogb2JqZWN0O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiBcclxuICAgICAqIOWqkui1hOaJmOeuoeWQjuerr+acjeWKoemUmeivr1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBSZW1vdGVFcnJvckRldGFpbCB7XHJcbiAgICAgICAgY29kZTogc3RyaW5nO1xyXG4gICAgICAgIG1lc3NhZ2U6IHN0cmluZztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOivt+axguaIkOWKn+WQjuWQjuerr+acjeWKoei/lOWbnueahOaVsOaNrlxyXG4gICAgICogQHR5cGVwYXJhbSBUIOWQjuerr+acjeWKoei/lOWbnuaIkOWKn+aXtueahOaVsOaNruexu+Wei1xyXG4gICAgICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIFJlcXVlc3RSZXN1bHQ8VD4ge1xyXG4gICAgICAgIC8qKiBIVFRQIOeKtuaAgeegge+8iOWTjeW6lOegge+8iSAqL1xyXG4gICAgICAgIHN0YXR1c0NvZGU6IG51bWJlcjtcclxuICAgICAgICAvKiog5ZCO56uv5pyN5Yqh6L+U5Zue55qE5pWw5o2uICovXHJcbiAgICAgICAgZGF0YTogVDtcclxuICAgIH1cclxuXHJcbiAgICAvKiog5a6M5oiQ6K+35rGC55qE5Zue6LCD5Ye95pWwICovXHJcbiAgICBleHBvcnQgdHlwZSBSZXF1ZXN0Q2FsbGJhY2s8VCA9ICcnPiA9IEdlbmVyYWxDYWxsYmFjazxSZXF1ZXN0UmVzdWx0PFQ+PjtcclxuXHJcbiAgICAvKiog56ef5oi356m66Ze05omp5bGV6YCJ6aG5ICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIFNwYWNlRXh0ZW5zaW9uIHtcclxuICAgICAgICAvKiog56ef5oi356m66Ze05piv5ZCm5YWB6K645Yy/5ZCN6K+75Y+W77yM5Y2z5peg6ZyA6K6/6Zeu5Luk54mM5Y2z5Y+v6K+75Y+W56m66Ze05YaF5a6544CC6K+l5omp5bGV6YCJ6aG55YWB6K646ZqP5ZCO5L+u5pS544CCICovXHJcbiAgICAgICAgaXNQdWJsaWNSZWFkPzogYm9vbGVhbjtcclxuICAgICAgICAvKiog5aqS5L2T5bqT5piv5ZCm5Li65aSa55u457C/5qih5byP77yM5aaC5p6c5Li65aSa55u457C/5qih5byP5YiZ5b+F6aG75YWI5Yib5bu655u457C/77yM5omN6IO95Zyo55u457C/5Lit5LiK5Lyg5aqS5L2T6LWE5rqQ77yM5ZCm5YiZ5LiN5YWB6K645Yib5bu655u457C/77yM5Y+q6IO95Zyo56ef5oi356m66Ze05qC555uu5b2V5Lit5LiK5Lyg5aqS5L2T6LWE5rqQ44CC6K+l5omp5bGV6YCJ6aG55LiN5YWB6K646ZqP5ZCO5L+u5pS577yM5LuF5pSv5oyB5Zyo5Yib5bu656ef5oi356m66Ze05pe25oyH5a6a44CCICovXHJcbiAgICAgICAgaXNNdWx0aUFsYnVtPzogYm9vbGVhbjtcclxuICAgICAgICAvKiog56ef5oi356m66Ze05piv5ZCm5YWB6K645LiK5Lyg5Zu+54mHICovXHJcbiAgICAgICAgYWxsb3dQaG90bz86IGJvb2xlYW47XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtOaYr+WQpuWFgeiuuOS4iuS8oOinhumikSAqL1xyXG4gICAgICAgIGFsbG93VmlkZW8/OiBib29sZWFuO1xyXG4gICAgICAgIC8qKiDmlofku7blupPlhYHorrjkuIrkvKDnmoTmianlsZXlkI3vvIzlpoIgLnppcCwgLmRvY3gg562J77yM5aaC5p6c5LiN5oyH5a6a5oiW5oyH5a6a5Li656m65pWw57uE5YiZ5YWB6K645LiK5Lyg5omA5pyJ5omp5bGV5ZCN55qE5paH5Lu244CCICovXHJcbiAgICAgICAgYWxsb3dGaWxlRXh0bmFtZT86IHN0cmluZ1tdO1xyXG4gICAgICAgIC8qKiDlqpLkvZPlupPorqTlrprkuLrlm77niYfnmoTmianlsZXlkI3vvIzlpoIgLmpwZywgLnBuZyDnrYnvvIzlpoLmnpzkuI3mjIflrprmiJbmjIflrprkuLrnqbrmlbDnu4TliJnmoLnmja7mianlsZXlkI3oh6rliqjliKTmlq3mmK/lkKbkuLrluLjop4Hlm77niYfnsbvlnovjgIIgKi9cclxuICAgICAgICBhbGxvd1Bob3RvRXh0bmFtZT86IHN0cmluZ1tdO1xyXG4gICAgICAgIC8qKiDlqpLkvZPlupPorqTlrprkuLrop4bpopHnmoTmianlsZXlkI3vvIzlpoIgLm1wNCwgLm1vdiDnrYnvvIzlpoLmnpzkuI3mjIflrprmiJbmjIflrprkuLrnqbrmlbDnu4TliJnmoLnmja7mianlsZXlkI3oh6rliqjliKTmlq3mmK/lkKbkuLrluLjop4Hop4bpopHnsbvlnovjgIIgKi9cclxuICAgICAgICBhbGxvd1ZpZGVvRXh0bmFtZT86IHN0cmluZ1tdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5YWB6K646ZqP5ZCO5L+u5pS555qE5omp5bGV6YCJ6aG55ZCN77yM5bqT57G75Z6L44CB5piv5ZCm5aSa56ef5oi35ZKM5piv5ZCm5aSa55u457C/5LiN5YWB6K645L+u5pS544CCXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBleHBvcnQgdHlwZSBBbGxvd01vZGlmaWVkRXh0ZW5zaW9uRmllbGRzID0gJ2lzUHVibGljUmVhZCcgfCAnYWxsb3dQaG90bycgfCAnYWxsb3dWaWRlbycgfCAnYWxsb3dGaWxlRXh0bmFtZScgfCAnYWxsb3dQaG90b0V4dG5hbWUnIHwgJ2FsbG93VmlkZW9FeHRuYW1lJ1xyXG5cclxuICAgIC8qKiDlhYHorrjpmo/lkI7kv67mlLnnmoTnp5/miLfnqbrpl7TmianlsZXpgInpobkgKi9cclxuICAgIGV4cG9ydCB0eXBlIEFsbG93TW9kaWZpZWRTcGFjZUV4dGVuc2lvbiA9IFBpY2s8U3BhY2VFeHRlbnNpb24sIEFsbG93TW9kaWZpZWRFeHRlbnNpb25GaWVsZHM+O1xyXG5cclxuICAgIC8qKiDmiJDlip/liJvlu7rnmoTnp5/miLfnqbrpl7TnmoTnm7jlhbPkv6Hmga8gKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgQ3JlYXRlU3BhY2VSZXN1bHQge1xyXG4gICAgICAgIC8qKiDmiJDlip/liJvlu7rnmoTnp5/miLfnqbrpl7TnmoTnqbrpl7QgSUQgKi9cclxuICAgICAgICBzcGFjZUlkOiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWujOaIkOWIm+W7uuenn+aIt+epuumXtOeahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgQ3JlYXRlU3BhY2VDYWxsYmFjayA9IFJlcXVlc3RDYWxsYmFjazxDcmVhdGVTcGFjZVJlc3VsdD47XHJcblxyXG4gICAgLyoqIOWIhumhteWIl+WHuuebruW9leWPguaVsCAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBMaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25QYXJhbXMge1xyXG4gICAgICAgIC8qKiDnm67lvZXot6/lvoQgKi9cclxuICAgICAgICBwYXRoOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOWIhumhteagh+iusO+8jOWmguS4jeaMh+WumuWImeS7jummluadoeW8gOWni+i/lOWbnuOAgiAqL1xyXG4gICAgICAgIG1hcmtlcj86IG51bWJlcjtcclxuICAgICAgICAvKiog5Y2V6aG15pyA5aSa5p2h55uu5pWw77yM5LiN6IO96LaF6L+HIDEwMDDvvIzlpoLkuI3mjIflrprpu5jorqTkuLogMTAwMOOAgiAqL1xyXG4gICAgICAgIGxpbWl0PzogbnVtYmVyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDnm67lvZXlhoXlrrnmnaHnm64gKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0b3J5Q29udGVudCB7XHJcbiAgICAgICAgLyoqIOWtkOebruW9leaIluaWh+S7tuWQjSAqL1xyXG4gICAgICAgIG5hbWU6IHN0cmluZztcclxuICAgICAgICAvKiog5p2h55uu57G75Z6LICovXHJcbiAgICAgICAgdHlwZTogJ2RpcicgfCAnZmlsZScgfCAnaW1hZ2UnIHwgJ3ZpZGVvJztcclxuICAgICAgICAvKiog5Yib5bu65pe26Ze0ICovXHJcbiAgICAgICAgY3JlYXRpb25UaW1lOiBEYXRlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDmiJDlip/liJflh7rnmoTluKbliIbpobXnmoTnm67lvZXlhoXlrrnkv6Hmga8gKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgTGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uUmVzdWx0IHtcclxuICAgICAgICAvKiog5b2T5YmN5YiX5Ye655qE55uu5b2V55qE6Lev5b6E57uT5p6EICovXHJcbiAgICAgICAgcGF0aDogc3RyaW5nW107XHJcbiAgICAgICAgLyoqIOWIhumhteagh+iusO+8jOW9k+i/lOWbnuivpeWtl+auteaXtuivtOaYjuWIl+WHuueahOadoeebruacieaIquaWre+8jOmcgOe7p+e7reWIl+WHuuWQjue7reWIhumhteOAgiAqL1xyXG4gICAgICAgIG5leHRNYXJrZXI/OiBudW1iZXI7XHJcbiAgICAgICAgLyoqIOebruW9leWGheWuueadoeebruWIl+ihqCAqL1xyXG4gICAgICAgIGNvbnRlbnRzOiBEaXJlY3RvcnlDb250ZW50W107XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWujOaIkOWIhumhteWIl+WHuuaMh+WumuebruW9leeahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgTGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uQ2FsbGJhY2sgPSBSZXF1ZXN0Q2FsbGJhY2s8TGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uUmVzdWx0PjtcclxuXHJcbiAgICAvKiog5oiQ5Yqf5YiX5Ye655qE55uu5b2V5YaF5a655L+h5oGvICovXHJcbiAgICBleHBvcnQgdHlwZSBMaXN0RGlyZWN0b3J5UmVzdWx0ID0gT21pdDxMaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25SZXN1bHQsICduZXh0TWFya2VyJz47XHJcblxyXG4gICAgLyoqIOWujOaIkOWIl+WHuuebruW9leeahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgTGlzdERpcmVjdG9yeUNhbGxiYWNrID0gR2VuZXJhbENhbGxiYWNrPExpc3REaXJlY3RvcnlSZXN1bHQ+O1xyXG5cclxuICAgIC8qKiDlrozmiJDojrflj5YgVVJMIOeahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgR2V0VXJsQ2FsbGJhY2sgPSBHZW5lcmFsQ2FsbGJhY2s8c3RyaW5nW10+O1xyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LiK5Lyg5Y+C5pWw5L+h5oGvXHJcbiAgICAgKiBAcHJpdmF0ZVxyXG4gICAgICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEJlZ2luVXBsb2FkUmVzdWx0IHtcclxuICAgICAgICAvKiog5LiK5Lyg55uu5qCH5Z+f5ZCNICovXHJcbiAgICAgICAgZG9tYWluOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOS4iuS8oOihqOWNleWtl+autSAqL1xyXG4gICAgICAgIGZvcm06IFF1ZXJ5LFxyXG4gICAgICAgIC8qKiDkuIrkvKDnoa7orqTlj4LmlbAgKi9cclxuICAgICAgICBjb25maXJtS2V5OiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOaIkOWKn+S4iuS8oOOAgemHjeWRveWQjeaIluenu+WKqOeahOebruagh+aWh+S7tuS/oeaBryAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBVcGxvYWRSZXN1bHQge1xyXG4gICAgICAgIC8qKiDnm67moIfmlofku7bot6/lvoTnu5PmnoQgKi9cclxuICAgICAgICBwYXRoOiBzdHJpbmdbXTtcclxuICAgIH1cclxuXHJcbiAgICAvKiog5a6M5oiQ5LiK5Lyg44CB6YeN5ZG95ZCN56e75Yqo55qE5Zue6LCD5Ye95pWwICovXHJcbiAgICBleHBvcnQgdHlwZSBVcGxvYWRDYWxsYmFjayA9IFJlcXVlc3RDYWxsYmFjazxVcGxvYWRSZXN1bHQ+O1xyXG59XHJcblxyXG4vKipcclxuICog5aqS6LWE5omY566h5ZCO56uv5pyN5Yqh6L+U5Zue55qE55uu5b2V5YaF5a655p2h55uuXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5pbnRlcmZhY2UgRGlyZWN0b3J5Q29udGVudElubmVyIGV4dGVuZHMgT21pdDxNSC5EaXJlY3RvcnlDb250ZW50LCAnY3JlYXRpb25UaW1lJz4ge1xyXG4gICAgLyoqIOWIm+W7uuaXtumXtCAqL1xyXG4gICAgY3JlYXRpb25UaW1lOiBzdHJpbmc7XHJcbn1cclxuXHJcbi8qKlxyXG4gKiDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHov5Tlm57nmoTluKbliIbpobXnmoTnm67lvZXlhoXlrrnkv6Hmga9cclxuICogQHByaXZhdGVcclxuICovXHJcbmludGVyZmFjZSBMaXN0RGlyZWN0b3J5UmVzdWx0SW5uZXIgZXh0ZW5kcyBPbWl0PE1ILkxpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvblJlc3VsdCwgJ2NvbnRlbnRzJz4ge1xyXG4gICAgLyoqIOebruW9leWGheWuueadoeebruWIl+ihqCAqL1xyXG4gICAgY29udGVudHM6IERpcmVjdG9yeUNvbnRlbnRJbm5lcltdO1xyXG59XHJcblxyXG5leHBvcnQgeyBNSCBhcyBNZWRpYUhvc3RpbmcgfTtcclxuIl19