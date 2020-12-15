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
    MH.checkNeedRefreshToken = function (token, tokenTimestamp, forceRenew) {
        var sinceLastRefresh = Math.floor((Date.now() - tokenTimestamp) / 1000);
        if ((!forceRenew && token.expiresIn - sinceLastRefresh > MIN_PERIOD_SECONDS)
            || sinceLastRefresh < MIN_PERIOD_SECONDS) {
            return false;
        }
        return true;
    };
    MH.isRemoteError = function (data) {
        return typeof data === 'object' && typeof data.code === 'string' && typeof data.message === 'string';
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
    MH.encodePath = function (path) {
        return path.split('/').filter(function (name) { return name; }).map(function (name) { return encodeURIComponent(name); }).join('/');
    };
    MH.ensureMultiSpaceToken = function (libraryId, spaceIdList, userId, callback) {
        if (typeof userId === 'function') {
            callback = userId;
            userId = void 0;
        }
        userId = userId || '';
        var key = [libraryId, userId].join('$');
        if (!(key in MH.multiSpaceAccessTokenMapping)) {
            MH.multiSpaceAccessTokenMapping[key] = {};
        }
        var mapping = MH.multiSpaceAccessTokenMapping[key];
        var pendingSpaceIdList = [];
        var result = {};
        for (var _i = 0, spaceIdList_1 = spaceIdList; _i < spaceIdList_1.length; _i++) {
            var spaceId = spaceIdList_1[_i];
            var accessToken = mapping[spaceId];
            if (accessToken && !MH.checkNeedRefreshToken(accessToken.token, accessToken.timestamp, true)) {
                result[spaceId] = accessToken.token;
            }
            else {
                pendingSpaceIdList.push(spaceId);
            }
        }
        if (!pendingSpaceIdList.length) {
            return callback === null || callback === void 0 ? void 0 : callback(null, result);
        }
        if (typeof MH.getMultiSpaceAccessToken !== 'function') {
            return callback === null || callback === void 0 ? void 0 : callback(new MH.ParamError('Invalid getMultiSpaceAccessToken'));
        }
        MH.getMultiSpaceAccessToken({ libraryId: libraryId, spaceIdList: pendingSpaceIdList, userId: userId }, function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(new MH.GetAccessTokenError(err));
            }
            var timestamp = Date.now();
            var spaceIdToken = { token: token, timestamp: timestamp };
            for (var _i = 0, pendingSpaceIdList_1 = pendingSpaceIdList; _i < pendingSpaceIdList_1.length; _i++) {
                var spaceId = pendingSpaceIdList_1[_i];
                mapping[spaceId] = spaceIdToken;
                result[spaceId] = token;
            }
            callback === null || callback === void 0 ? void 0 : callback(null, result);
        });
    };
    MH.getSpaceCoverUrl = function (libraryId, spaceIdList, size, callback) {
        MH.ensureMultiSpaceToken(libraryId, spaceIdList, function (err, token) {
            if (MH.hasError(err, token)) {
                return callback === null || callback === void 0 ? void 0 : callback(err);
            }
            var urls = spaceIdList.map(function (spaceId) { return URL_PREFIX + "/album/" + libraryId + "/" + spaceId + "/cover?" + MH.stringifyQueryString({
                access_token: token[spaceId].accessToken,
                size: size,
            }); });
            callback === null || callback === void 0 ? void 0 : callback(null, urls);
        });
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
                return callback === null || callback === void 0 ? void 0 : callback(new MH.GetAccessTokenError(err));
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
        if (!MH.checkNeedRefreshToken(token, this.tokenTimestamp, forceRenew)) {
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
                    return callback === null || callback === void 0 ? void 0 : callback(new MH.RemoteError(result.statusCode, data.code, data.message));
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
                        return callback === null || callback === void 0 ? void 0 : callback(new MH.RemoteError(result.statusCode, data.code, data.message));
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
                if (retriedTimes >= 2 || (err instanceof MH.GetAccessTokenError) ||
                    (err instanceof MH.RemoteError) && (err.status === 403 || err.status === 404)) {
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
    MH.multiSpaceAccessTokenMapping = {};
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
    var GetAccessTokenError = (function (_super) {
        __extends(GetAccessTokenError, _super);
        function GetAccessTokenError(nestedError) {
            var _this = _super.call(this, (nestedError === null || nestedError === void 0 ? void 0 : nestedError.message) || 'An error occured while getting access token') || this;
            _this.nestedError = nestedError;
            if (nestedError) {
                _this.stack = nestedError.stack;
            }
            return _this;
        }
        return GetAccessTokenError;
    }(BaseError));
    MH.GetAccessTokenError = GetAccessTokenError;
    var RemoteError = (function (_super) {
        __extends(RemoteError, _super);
        function RemoteError(status, code, message) {
            var _this = _super.call(this, message) || this;
            _this.status = status;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFNQSxJQUFNLGtCQUFrQixHQUFHLEdBQUcsQ0FBQztBQUsvQixJQUFNLFVBQVUsR0FBRyxrQ0FBa0MsQ0FBQztBQVN0RDtJQXNESSxZQUFZLE1BQTRCO1FBUGhDLG1CQUFjLEdBQVcsQ0FBQyxDQUFDO1FBQzNCLGVBQVUsR0FBVyxDQUFDLENBQUM7UUFPbkIsSUFBQSxTQUFTLEdBQXNDLE1BQU0sVUFBNUMsRUFBRSxPQUFPLEdBQTZCLE1BQU0sUUFBbkMsRUFBRSxNQUFNLEdBQXFCLE1BQU0sT0FBM0IsRUFBRSxjQUFjLEdBQUssTUFBTSxlQUFYLENBQVk7UUFDOUQsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDM0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFFdEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxjQUFjLENBQUM7SUFDekMsQ0FBQztJQXhDRCxzQkFBSSx1QkFBTzthQUFYO1lBQ0ksT0FBTyxJQUFJLENBQUMsUUFBUSxJQUFJLEdBQUcsQ0FBQztRQUNoQyxDQUFDO2FBRUQsVUFBWSxLQUFhO1lBQ3JCLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxLQUFLLEVBQUU7Z0JBQ3pCLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7YUFDMUI7WUFDRCxJQUFJLENBQUMsUUFBUSxHQUFHLEtBQUssQ0FBQztRQUMxQixDQUFDOzs7T0FQQTtJQVVELHNCQUFJLHNCQUFNO2FBQVY7WUFDSSxPQUFPLElBQUksQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQzlCLENBQUM7YUFFRCxVQUFXLEtBQWE7WUFDcEIsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLEtBQUssRUFBRTtnQkFD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QU0sQ0FBQztZQUNyQixLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQzs7UUFDckIsQ0FBQztRQUNMLGtCQUFDO0lBQUQsQ0FBQyxBQXBCRCxDQUFpQyxTQUFTLEdBb0J6QztJQXBCWSxjQUFXLGNBb0J2QixDQUFBO0lBR0Q7UUFBOEIsNEJBQVM7UUFZbkMsa0JBQVksUUFBcUI7WUFBckIseUJBQUEsRUFBQSxhQUFxQjs7WUFBakMsaUJBT0M7WUFORyxJQUFNLElBQUksR0FBRyxPQUFBLHdCQUF3QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsMENBQUcsQ0FBQyxNQUFLLEVBQUUsQ0FBQztZQUNoRSxJQUFNLE9BQU8sR0FBRyxPQUFBLDhCQUE4QixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsMENBQUcsQ0FBQyxNQUFLLEVBQUUsQ0FBQztZQUN6RSxJQUFNLFNBQVMsR0FBRyxPQUFBLGtDQUFrQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsMENBQUcsQ0FBQyxNQUFLLEVBQUUsQ0FBQztZQUMvRSxRQUFBLGtCQUFNLE9BQU8sQ0FBQyxTQUFDO1lBQ2YsS0FBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7WUFDakIsS0FBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7O1FBQy9CLENBQUM7UUFDTCxlQUFDO0lBQUQsQ0FBQyxBQXBCRCxDQUE4QixTQUFTLEdBb0J0QztJQXBCWSxXQUFRLFdBb0JwQixDQUFBO0FBK05MLENBQUMsRUFuVFMsRUFBRSxLQUFGLEVBQUUsUUFtVFg7QUFvQmMsMEJBQVkiLCJzb3VyY2VzQ29udGVudCI6WyIvKiog5aqS6LWE5omY566h5a6i5oi356uv5bCP56iL5bqPIFNESyAqL1xyXG5cclxuLyoqXHJcbiAqIOiuv+mXruS7pOeJjOacgOWwj+acieaViOaXtumVv++8jOW9k+iuv+mXruS7pOeJjOWJqeS9meacieaViOaXtumVv+S9juS6juivpeWAvOaXtu+8jOWwhuinpuWPkee7reacn+aIluWIt+aWsOiuv+mXruS7pOeJjOOAglxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuY29uc3QgTUlOX1BFUklPRF9TRUNPTkRTID0gMzAwO1xyXG4vKipcclxuICog5aqS6LWE5omY566h5ZCO56uv5pyN5YqhIFVSTCDliY3nvIBcclxuICogQHByaXZhdGVcclxuICovXHJcbmNvbnN0IFVSTF9QUkVGSVggPSAnaHR0cHM6Ly9zbWgudGVuY2VudGNzLmNvbS9hcGkvdjEnO1xyXG5cclxuLyoqXHJcbiAqIOWqkui1hOaJmOeuoeWuouaIt+err+OAguivpeexu+WSjOWRveWQjeepuumXtOS9v+eUqOWQjeWtlyBNZWRpYUhvc3Rpbmcg5a+85Ye677yaXHJcbiAqIFxyXG4gKiBgYGBqc1xyXG4gKiBleHBvcnQgeyBNSCBhcyBNZWRpYUhvc3RpbmcgfTtcclxuICogYGBgXHJcbiAqL1xyXG5jbGFzcyBNSCB7XHJcblxyXG4gICAgcHJpdmF0ZSBzdGF0aWMgbXVsdGlTcGFjZUFjY2Vzc1Rva2VuTWFwcGluZzoge1xyXG4gICAgICAgIFtrZXk6IHN0cmluZ106IHtcclxuICAgICAgICAgICAgW3NwYWNlSWQ6IHN0cmluZ106IHtcclxuICAgICAgICAgICAgICAgIC8qKiDorr/pl67ku6TniYwgKi9cclxuICAgICAgICAgICAgICAgIHRva2VuOiBNSC5BY2Nlc3NUb2tlbjtcclxuICAgICAgICAgICAgICAgIC8qKiDorr/pl67ku6TniYznlJ/miJDml7bpl7QgKi9cclxuICAgICAgICAgICAgICAgIHRpbWVzdGFtcDogbnVtYmVyO1xyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgIH07XHJcbiAgICB9ID0ge307XHJcbiAgICBzdGF0aWMgZ2V0TXVsdGlTcGFjZUFjY2Vzc1Rva2VuOiBNSC5HZXRNdWx0aVNwYWNlQWNjZXNzVG9rZW5GdW5jO1xyXG5cclxuICAgIHByaXZhdGUgX3NwYWNlSWQ/OiBzdHJpbmc7XHJcbiAgICBwcml2YXRlIF91c2VySWQ/OiBzdHJpbmc7XHJcblxyXG4gICAgLyoqIOiOt+WPluW9k+WJjeaMh+WumueahOWqkuS9k+W6kyBJRCAqL1xyXG4gICAgcmVhZG9ubHkgbGlicmFyeUlkOiBzdHJpbmc7XHJcblxyXG4gICAgLyoqIOiOt+WPluW9k+WJjeaMh+WumueahOenn+aIt+epuumXtCBJRCAqL1xyXG4gICAgZ2V0IHNwYWNlSWQoKSB7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX3NwYWNlSWQgfHwgJy0nO1xyXG4gICAgfVxyXG4gICAgLyoqIOiuvue9ruenn+aIt+epuumXtCBJRCAqL1xyXG4gICAgc2V0IHNwYWNlSWQodmFsdWU6IHN0cmluZykge1xyXG4gICAgICAgIGlmICh0aGlzLl9zcGFjZUlkICE9PSB2YWx1ZSkge1xyXG4gICAgICAgICAgICB0aGlzLnVwZGF0ZVRva2VuKG51bGwpO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLl9zcGFjZUlkID0gdmFsdWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOiOt+WPluW9k+WJjeaMh+WumueahOeUqOaItyBJRCAqL1xyXG4gICAgZ2V0IHVzZXJJZCgpIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fdXNlcklkIHx8ICcnO1xyXG4gICAgfVxyXG4gICAgLyoqIOiuvue9rueUqOaItyBJRCAqL1xyXG4gICAgc2V0IHVzZXJJZCh2YWx1ZTogc3RyaW5nKSB7XHJcbiAgICAgICAgaWYgKHRoaXMuX3VzZXJJZCAhPT0gdmFsdWUpIHtcclxuICAgICAgICAgICAgdGhpcy51cGRhdGVUb2tlbihudWxsKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5fdXNlcklkID0gdmFsdWU7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSByZWFkb25seSBnZXRBY2Nlc3NUb2tlbjogTUguR2V0QWNjZXNzVG9rZW5GdW5jO1xyXG5cclxuICAgIHByaXZhdGUgdG9rZW4/OiBNSC5BY2Nlc3NUb2tlbjtcclxuICAgIHByaXZhdGUgdG9rZW5UaW1lc3RhbXA6IG51bWJlciA9IDA7XHJcbiAgICBwcml2YXRlIHRva2VuVGltZXI6IG51bWJlciA9IDA7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlrp7kvovljJblqpLotYTmiZjnrqHlrqLmiLfnq69cclxuICAgICAqIEBwYXJhbSBwYXJhbXMg5a6e5L6L5YyW5Y+C5pWwXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKHBhcmFtczogTUguQ29uc3RydWN0b3JQYXJhbXMpIHtcclxuICAgICAgICBjb25zdCB7IGxpYnJhcnlJZCwgc3BhY2VJZCwgdXNlcklkLCBnZXRBY2Nlc3NUb2tlbiB9ID0gcGFyYW1zO1xyXG4gICAgICAgIHRoaXMubGlicmFyeUlkID0gbGlicmFyeUlkO1xyXG4gICAgICAgIHRoaXMuX3NwYWNlSWQgPSBzcGFjZUlkO1xyXG4gICAgICAgIHRoaXMuX3VzZXJJZCA9IHVzZXJJZDtcclxuXHJcbiAgICAgICAgdGhpcy5nZXRBY2Nlc3NUb2tlbiA9IGdldEFjY2Vzc1Rva2VuO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yik5pat5Zue6LCD5piv5ZCm5Li66ZSZ6K+v5Zue6LCD77yM5b2T5Y+R55Sf6ZSZ6K+v5pe2IHJlc3VsdCDkuLogdW5kZWZpbmVk77yM5ZCm5YiZIHJlc3VsdCDkuI3kuLogdW5kZWZpbmVk44CCXHJcbiAgICAgKiBAcGFyYW0gZXJyIOmUmeivr+aIliBudWxsXHJcbiAgICAgKiBAcGFyYW0gcmVzdWx0IOWbnuiwg+e7k+aenOWAvFxyXG4gICAgICogQHJldHVybnMg5piv5ZCm5Li66ZSZ6K+v5Zue6LCD77yM5q2k5pe2IHJlc3VsdCDkuLogdW5kZWZpbmVk44CCXHJcbiAgICAgKi9cclxuICAgIC8vIEB0cy1pZ25vcmU6IGVycm9yIFRTNjEzMzogJ3Jlc3VsdCcgaXMgZGVjbGFyZWQgYnV0IGl0cyB2YWx1ZSBpcyBuZXZlciByZWFkLlxyXG4gICAgcHJpdmF0ZSBzdGF0aWMgaGFzRXJyb3IoZXJyOiBFcnJvciB8IG51bGwsIHJlc3VsdDogYW55KTogcmVzdWx0IGlzIHVuZGVmaW5lZCB7XHJcbiAgICAgICAgcmV0dXJuICEhZXJyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5qOA5p+l5oyH5a6a55qE6K6/6Zeu5Luk54mM5piv5ZCm6ZyA6KaB5Yi35pawXHJcbiAgICAgKiBAcGFyYW0gdG9rZW4g6K6/6Zeu5Luk54mMXHJcbiAgICAgKiBAcGFyYW0gdG9rZW5UaW1lc3RhbXAg6K6/6Zeu5Luk54mM55Sf5oiQ5pe26Ze0XHJcbiAgICAgKiBAcGFyYW0gZm9yY2VSZW5ldyDmmK/lkKblvLrliLbnu63mnJ9cclxuICAgICAqL1xyXG4gICAgcHJpdmF0ZSBzdGF0aWMgY2hlY2tOZWVkUmVmcmVzaFRva2VuKHRva2VuOiBNSC5BY2Nlc3NUb2tlbiwgdG9rZW5UaW1lc3RhbXA6IG51bWJlciwgZm9yY2VSZW5ldz86IGJvb2xlYW4pIHtcclxuICAgICAgICBjb25zdCBzaW5jZUxhc3RSZWZyZXNoID0gTWF0aC5mbG9vcigoRGF0ZS5ub3coKSAtIHRva2VuVGltZXN0YW1wKSAvIDEwMDApO1xyXG4gICAgICAgIGlmICgoIWZvcmNlUmVuZXcgJiYgdG9rZW4uZXhwaXJlc0luIC0gc2luY2VMYXN0UmVmcmVzaCA+IE1JTl9QRVJJT0RfU0VDT05EUylcclxuICAgICAgICAgICAgfHwgc2luY2VMYXN0UmVmcmVzaCA8IE1JTl9QRVJJT0RfU0VDT05EUykge1xyXG4gICAgICAgICAgICAvLyDkuI3pnIDopoHlvLrliLbliLfmlrDkuJTmnInmlYjmnJ/otoXov4c15YiG6ZKf77yM5oiW6ICF6ZyA6KaB5by65Yi25Yi35paw5L2G6Led56a75LiK5qyh5Yi35paw5LiN6LazNeWIhumSn++8jOebtOaOpei/lOWbnlxyXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yik5pat5aqS6LWE5omY566h5ZCO56uv5pyN5Yqh6L+U5Zue55qE5pWw5o2u5piv5ZCm5Li65ZCO56uv6ZSZ6K+vXHJcbiAgICAgKiBAcGFyYW0gZGF0YSDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHov5Tlm57nmoTmlbDmja5cclxuICAgICAqIEByZXR1cm5zIOaYr+WQpuS4uuWQjuerr+mUmeivr1xyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHN0YXRpYyBpc1JlbW90ZUVycm9yKGRhdGE6IGFueSk6IGRhdGEgaXMgTUguUmVtb3RlRXJyb3JEZXRhaWwge1xyXG4gICAgICAgIHJldHVybiB0eXBlb2YgZGF0YSA9PT0gJ29iamVjdCcgJiYgdHlwZW9mIGRhdGEuY29kZSA9PT0gJ3N0cmluZycgJiYgdHlwZW9mIGRhdGEubWVzc2FnZSA9PT0gJ3N0cmluZyc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDlrZfnrKbkuLLljJbmn6Xor6LlrZfnrKbkuLJcclxuICAgICAqIEBwYXJhbSBxdWVyeSDmn6Xor6LlrZfnrKbkuLLplK7lgLzlr7lcclxuICAgICAqIEByZXR1cm5zIOafpeivouWtl+espuS4slxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgc3RyaW5naWZ5UXVlcnlTdHJpbmcocXVlcnk6IE1ILlF1ZXJ5KSB7XHJcbiAgICAgICAgY29uc3QgcXVlcnlMaXN0ID0gW107XHJcbiAgICAgICAgZm9yIChjb25zdCBuYW1lIGluIHF1ZXJ5KSB7XHJcbiAgICAgICAgICAgIGxldCB2YWx1ZSA9IHF1ZXJ5W25hbWVdO1xyXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XHJcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IFt2YWx1ZV07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgZm9yIChjb25zdCBzdWJWYWx1ZSBvZiB2YWx1ZSkge1xyXG4gICAgICAgICAgICAgICAgaWYgKHN1YlZhbHVlID09PSB2b2lkIDApIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgIGlmIChzdWJWYWx1ZSA9PT0gJycpIHtcclxuICAgICAgICAgICAgICAgICAgICBxdWVyeUxpc3QucHVzaChlbmNvZGVVUklDb21wb25lbnQobmFtZSkpO1xyXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgICAgICBxdWVyeUxpc3QucHVzaChgJHtlbmNvZGVVUklDb21wb25lbnQobmFtZSl9PSR7ZW5jb2RlVVJJQ29tcG9uZW50KFN0cmluZyhzdWJWYWx1ZSkpfWApO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHF1ZXJ5U3RyaW5nID0gcXVlcnlMaXN0Lmxlbmd0aCA/IHF1ZXJ5TGlzdC5qb2luKCcmJykgOiAnJztcclxuICAgICAgICByZXR1cm4gcXVlcnlTdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDnvJbnoIHot6/lvoRcclxuICAgICAqIEBwYXJhbSBwYXRoIOWOn+Wni+i3r+W+hFxyXG4gICAgICogQHJldHVybnMg57yW56CB5ZCO5Y+v55u05o6l5ou85o6l5ZyoIFVSTCDkuK3nmoTot6/lvoRcclxuICAgICAqL1xyXG4gICAgc3RhdGljIGVuY29kZVBhdGgocGF0aDogc3RyaW5nKSB7XHJcbiAgICAgICAgcmV0dXJuIHBhdGguc3BsaXQoJy8nKS5maWx0ZXIobmFtZSA9PiBuYW1lKS5tYXAobmFtZSA9PiBlbmNvZGVVUklDb21wb25lbnQobmFtZSkpLmpvaW4oJy8nKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOehruS/neWPr+eUqOS6juWkmuS4quaMh+Wumuenn+aIt+epuumXtOeahOiuv+mXruS7pOeJjOWtmOWcqOS4lOWcqOacieaViOacn+WGhe+8jOWQpuWImeWwhuiHquWKqOabtOaWsOiuv+mXruS7pOeJjOOAglxyXG4gICAgICogQHBhcmFtIGxpYnJhcnlJZCDlqpLkvZPlupMgSURcclxuICAgICAqIEBwYXJhbSBzcGFjZUlkTGlzdCDnp5/miLfnqbrpl7QgSUQg5YiX6KGoXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5ZCO56ym5ZCI6KaB5rGC5pyJ5pWI5pyf55qE5Y+v55So5LqO5aSa5Liq5oyH5a6a56ef5oi356m66Ze055qE6K6/6Zeu5Luk54mM44CCXHJcbiAgICAgKi9cclxuICAgIHN0YXRpYyBlbnN1cmVNdWx0aVNwYWNlVG9rZW4obGlicmFyeUlkOiBzdHJpbmcsIHNwYWNlSWRMaXN0OiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBNSC5HZXRNdWx0aVNwYWNlQWNjZXNzVG9rZW5DYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOehruS/neWPr+eUqOS6juWkmuS4quaMh+Wumuenn+aIt+epuumXtOeahOiuv+mXruS7pOeJjOWtmOWcqOS4lOWcqOacieaViOacn+WGhe+8jOWQpuWImeWwhuiHquWKqOabtOaWsOiuv+mXruS7pOeJjOOAglxyXG4gICAgICogQHBhcmFtIGxpYnJhcnlJZCDlqpLkvZPlupMgSURcclxuICAgICAqIEBwYXJhbSBzcGFjZUlkTGlzdCDnp5/miLfnqbrpl7QgSUQg5YiX6KGoXHJcbiAgICAgKiBAcGFyYW0gdXNlcklkIOeUqOaItyBJRFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuespuWQiOimgeaxguacieaViOacn+eahOWPr+eUqOS6juWkmuS4quaMh+Wumuenn+aIt+epuumXtOeahOiuv+mXruS7pOeJjOOAglxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZW5zdXJlTXVsdGlTcGFjZVRva2VuKGxpYnJhcnlJZDogc3RyaW5nLCBzcGFjZUlkTGlzdDogc3RyaW5nW10sIHVzZXJJZDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILkdldE11bHRpU3BhY2VBY2Nlc3NUb2tlbkNhbGxiYWNrKTogdm9pZDtcclxuICAgIHN0YXRpYyBlbnN1cmVNdWx0aVNwYWNlVG9rZW4obGlicmFyeUlkOiBzdHJpbmcsIHNwYWNlSWRMaXN0OiBzdHJpbmdbXSwgdXNlcklkPzogc3RyaW5nIHwgTUguR2V0TXVsdGlTcGFjZUFjY2Vzc1Rva2VuQ2FsbGJhY2ssIGNhbGxiYWNrPzogTUguR2V0TXVsdGlTcGFjZUFjY2Vzc1Rva2VuQ2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIHVzZXJJZCA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBjYWxsYmFjayA9IHVzZXJJZDtcclxuICAgICAgICAgICAgdXNlcklkID0gdm9pZCAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICB1c2VySWQgPSB1c2VySWQgfHwgJyc7XHJcbiAgICAgICAgY29uc3Qga2V5ID0gW2xpYnJhcnlJZCwgdXNlcklkXS5qb2luKCckJyk7XHJcbiAgICAgICAgaWYgKCEoa2V5IGluIE1ILm11bHRpU3BhY2VBY2Nlc3NUb2tlbk1hcHBpbmcpKSB7XHJcbiAgICAgICAgICAgIE1ILm11bHRpU3BhY2VBY2Nlc3NUb2tlbk1hcHBpbmdba2V5XSA9IHt9O1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBtYXBwaW5nID0gTUgubXVsdGlTcGFjZUFjY2Vzc1Rva2VuTWFwcGluZ1trZXldO1xyXG4gICAgICAgIGNvbnN0IHBlbmRpbmdTcGFjZUlkTGlzdDogc3RyaW5nW10gPSBbXTtcclxuICAgICAgICBjb25zdCByZXN1bHQ6IE1ILk11bHRpU3BhY2VBY2Nlc3NUb2tlbiA9IHt9O1xyXG4gICAgICAgIGZvciAoY29uc3Qgc3BhY2VJZCBvZiBzcGFjZUlkTGlzdCkge1xyXG4gICAgICAgICAgICBjb25zdCBhY2Nlc3NUb2tlbiA9IG1hcHBpbmdbc3BhY2VJZF07XHJcbiAgICAgICAgICAgIGlmIChhY2Nlc3NUb2tlbiAmJiAhTUguY2hlY2tOZWVkUmVmcmVzaFRva2VuKGFjY2Vzc1Rva2VuLnRva2VuLCBhY2Nlc3NUb2tlbi50aW1lc3RhbXAsIHRydWUpKSB7XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbc3BhY2VJZF0gPSBhY2Nlc3NUb2tlbi50b2tlbjtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIHBlbmRpbmdTcGFjZUlkTGlzdC5wdXNoKHNwYWNlSWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghcGVuZGluZ1NwYWNlSWRMaXN0Lmxlbmd0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihudWxsLCByZXN1bHQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodHlwZW9mIE1ILmdldE11bHRpU3BhY2VBY2Nlc3NUb2tlbiAhPT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignSW52YWxpZCBnZXRNdWx0aVNwYWNlQWNjZXNzVG9rZW4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIE1ILmdldE11bHRpU3BhY2VBY2Nlc3NUb2tlbih7IGxpYnJhcnlJZCwgc3BhY2VJZExpc3Q6IHBlbmRpbmdTcGFjZUlkTGlzdCwgdXNlcklkIH0sIChlcnIsIHRva2VuKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHRva2VuKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILkdldEFjY2Vzc1Rva2VuRXJyb3IoZXJyKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcclxuICAgICAgICAgICAgY29uc3Qgc3BhY2VJZFRva2VuID0geyB0b2tlbiwgdGltZXN0YW1wIH07XHJcbiAgICAgICAgICAgIGZvciAoY29uc3Qgc3BhY2VJZCBvZiBwZW5kaW5nU3BhY2VJZExpc3QpIHtcclxuICAgICAgICAgICAgICAgIG1hcHBpbmdbc3BhY2VJZF0gPSBzcGFjZUlkVG9rZW47XHJcbiAgICAgICAgICAgICAgICByZXN1bHRbc3BhY2VJZF0gPSB0b2tlbjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDmibnph4/ojrflj5blqpLkvZPlupPmjIflrprnp5/miLfnqbrpl7TnmoTlsIHpnaLlm77niYcgVVJMXHJcbiAgICAgKiBAcGFyYW0gbGlicmFyeUlkIOWqkuS9k+W6kyBJROOAglxyXG4gICAgICogQHBhcmFtIHNwYWNlSWRMaXN0IOenn+aIt+epuumXtCBJRCDliJfooajjgIJcclxuICAgICAqIEBwYXJhbSBzaXplIOWwgemdouWbvueJh+Wkp+WwjyhweCnvvIzlsIbnvKnmlL7oo4HliarkuLrmraPmlrnlvaLlm77niYfvvIzlpoLkuI3mjIflrprliJnkuLrljp/lp4vlpKflsI/jgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTnm7jnsL/lsIHpnaLlm77niYcgVVJM44CCXHJcbiAgICAgKiBAcmV0dXJuIOS4juaMh+WumueahOenn+aIt+epuumXtCBJRCDliJfooajpobrluo/lr7nlupTnmoTnp5/miLfnqbrpl7TlsIHpnaLlm77niYcgVVJMIOWIl+ihqOOAglxyXG4gICAgICovXHJcbiAgICBzdGF0aWMgZ2V0U3BhY2VDb3ZlclVybChsaWJyYXJ5SWQ6IHN0cmluZywgc3BhY2VJZExpc3Q6IHN0cmluZ1tdLCBzaXplPzogbnVtYmVyLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKSB7XHJcbiAgICAgICAgTUguZW5zdXJlTXVsdGlTcGFjZVRva2VuKGxpYnJhcnlJZCwgc3BhY2VJZExpc3QsIChlcnIsIHRva2VuKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHRva2VuKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCB1cmxzID0gc3BhY2VJZExpc3QubWFwKHNwYWNlSWQgPT4gYCR7VVJMX1BSRUZJWH0vYWxidW0vJHtsaWJyYXJ5SWR9LyR7c3BhY2VJZH0vY292ZXI/JHtNSC5zdHJpbmdpZnlRdWVyeVN0cmluZyh7XHJcbiAgICAgICAgICAgICAgICBhY2Nlc3NfdG9rZW46IHRva2VuW3NwYWNlSWRdLmFjY2Vzc1Rva2VuLFxyXG4gICAgICAgICAgICAgICAgc2l6ZSxcclxuICAgICAgICAgICAgfSl9YCk7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwgdXJscyk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSB1cGRhdGVUb2tlbih0b2tlbj86IE1ILkFjY2Vzc1Rva2VuIHwgbnVsbCwgY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHRva2VuICYmIChcclxuICAgICAgICAgICAgdHlwZW9mIHRva2VuLmFjY2Vzc1Rva2VuICE9PSAnc3RyaW5nJyB8fCAhdG9rZW4uYWNjZXNzVG9rZW4gfHxcclxuICAgICAgICAgICAgdHlwZW9mIHRva2VuLmV4cGlyZXNJbiAhPT0gJ251bWJlcicgfHwgdG9rZW4uZXhwaXJlc0luIDw9IDBcclxuICAgICAgICApKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5CYXNlRXJyb3IoJ0ludmFsaWQgdG9rZW4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICh0b2tlbikge1xyXG4gICAgICAgICAgICB0aGlzLnRva2VuID0gdG9rZW47XHJcbiAgICAgICAgfSBlbHNlIGlmICh0b2tlbiA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICAvLyBmb3JjZSBlbXB0eSB0b2tlblxyXG4gICAgICAgICAgICB0aGlzLnRva2VuID0gdm9pZCAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLnRva2VuVGltZXN0YW1wID0gRGF0ZS5ub3coKTtcclxuICAgICAgICBpZiAodGhpcy50b2tlblRpbWVyKSB7XHJcbiAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aGlzLnRva2VuVGltZXIpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAodGhpcy50b2tlbikge1xyXG4gICAgICAgICAgICB0aGlzLnRva2VuVGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IHRoaXMuZW5zdXJlVG9rZW4oKSwgKHRoaXMudG9rZW4uZXhwaXJlc0luIC0gTUlOX1BFUklPRF9TRUNPTkRTKSAqIDEwMDApO1xyXG4gICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHRoaXMudG9rZW4pO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIt+aWsOiuv+mXruS7pOeJjFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOiuv+mXruS7pOeJjOWIt+aWsOWujOaIkOWbnuiwg++8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuacgOaWsOeahOiuv+mXruS7pOeJjOS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICByZWZyZXNoVG9rZW4oY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKSB7XHJcbiAgICAgICAgdGhpcy5nZXRBY2Nlc3NUb2tlbih7XHJcbiAgICAgICAgICAgIGxpYnJhcnlJZDogdGhpcy5saWJyYXJ5SWQsXHJcbiAgICAgICAgICAgIHNwYWNlSWQ6IHRoaXMuc3BhY2VJZCxcclxuICAgICAgICAgICAgdXNlcklkOiB0aGlzLnVzZXJJZCxcclxuICAgICAgICB9LCAoZXJyLCB0b2tlbikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCB0b2tlbikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5HZXRBY2Nlc3NUb2tlbkVycm9yKGVycikpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4odG9rZW4sIGNhbGxiYWNrKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOehruS/neiuv+mXruS7pOeJjOWtmOWcqOS4lOWcqOacieaViOacn+WGhe+8jOWQpuWImeWwhuiHquWKqOe7reacn+aIluWIt+aWsOiuv+mXruS7pOeJjOOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuWcqOacieaViOacn+WGheeahOiuv+mXruS7pOeJjOOAglxyXG4gICAgICovXHJcbiAgICBlbnN1cmVUb2tlbihjYWxsYmFjaz86IE1ILkdldEFjY2Vzc1Rva2VuQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDnoa7kv53orr/pl67ku6TniYzlrZjlnKjkuJTlnKjmnInmlYjmnJ/lhoXvvIzlkKbliJnlsIboh6rliqjnu63mnJ/miJbliLfmlrDorr/pl67ku6TniYzjgIJcclxuICAgICAqIEBwYXJhbSBmb3JjZVJlbmV3IOaYr+WQpuW8uuWItue7reacn++8jOaMh+WumuS4uiB0cnVlIOaXtu+8jOWmguaenOiuv+mXruS7pOeJjOi3neemu+S4iuasoeS9v+eUqOW3sue7j+i2hei/hyA1IOWIhumSn++8jOWwhuiHquWKqOe7reacn++8m+WmguaenOiuv+mXruS7pOeJjOWJqeS9meacieaViOacn+S4jei2syA1IOWIhumSn++8jOWImeW/veeVpeivpeWPguaVsOW8uuWItuiHquWKqOe7reacn+OAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuespuWQiOimgeaxguacieaViOacn+eahOiuv+mXruS7pOeJjOOAglxyXG4gICAgICovXHJcbiAgICBlbnN1cmVUb2tlbihmb3JjZVJlbmV3PzogYm9vbGVhbiwgY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKTogdm9pZDtcclxuICAgIGVuc3VyZVRva2VuKGZvcmNlUmVuZXc/OiBib29sZWFuIHwgTUguR2V0QWNjZXNzVG9rZW5DYWxsYmFjaywgY2FsbGJhY2s/OiBNSC5HZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKHR5cGVvZiBmb3JjZVJlbmV3ID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrID0gZm9yY2VSZW5ldztcclxuICAgICAgICAgICAgZm9yY2VSZW5ldyA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0aGlzLnRva2VuKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlZnJlc2hUb2tlbihjYWxsYmFjayk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IHRva2VuID0gdGhpcy50b2tlbiE7XHJcbiAgICAgICAgaWYgKCFNSC5jaGVja05lZWRSZWZyZXNoVG9rZW4odG9rZW4sIHRoaXMudG9rZW5UaW1lc3RhbXAsIGZvcmNlUmVuZXcpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG51bGwsIHRva2VuKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgd3gucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHVybDogYCR7VVJMX1BSRUZJWH0vdG9rZW4vJHt0aGlzLmxpYnJhcnlJZH0vJHt0b2tlbi5hY2Nlc3NUb2tlbn1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQT1NUJyxcclxuICAgICAgICAgICAgc3VjY2VzczogKHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgeyBkYXRhIH0gPSByZXN1bHQ7XHJcbiAgICAgICAgICAgICAgICBpZiAoTUguaXNSZW1vdGVFcnJvcihkYXRhKSkge1xyXG4gICAgICAgICAgICAgICAgICAgIGlmIChkYXRhLmNvZGUgPT09ICdJbnZhbGlkQWNjZXNzVG9rZW4nKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIOaXoOaViO+8jOebtOaOpeWIt+aWsFxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5yZWZyZXNoVG9rZW4oY2FsbGJhY2spO1xyXG4gICAgICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgICAgICAgICAvLyDlhbbku5bplJnor6/vvIzmipvlh7rljrtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUmVtb3RlRXJyb3IocmVzdWx0LnN0YXR1c0NvZGUsIGRhdGEuY29kZSwgZGF0YS5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0b2tlbiA9IGRhdGEgYXMgTUguQWNjZXNzVG9rZW47XHJcbiAgICAgICAgICAgICAgICB0aGlzLnVwZGF0ZVRva2VuKHRva2VuLCBjYWxsYmFjayk7XHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIGZhaWw6IChyZXMpID0+IHtcclxuICAgICAgICAgICAgICAgIC8vIOivt+axgumUmeivr++8jOaKm+WHuuWOu1xyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s/LihuZXcgTUguV3hSZXF1ZXN0RXJyb3IocmVzLmVyck1zZykpO1xyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5ZCR5aqS6LWE5omY566h5ZCO56uv5pyN5Yqh5Y+R6LW36K+35rGCXHJcbiAgICAgKiBAdHlwZXBhcmFtIFQg5ZCO56uv5pyN5Yqh6L+U5Zue5oiQ5Yqf5pe255qE5pWw5o2u57G75Z6LXHJcbiAgICAgKiBAcGFyYW0gcGFyYW1zIOivt+axguWPguaVsFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOivt+axguWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WQjuWQjuerr+acjeWKoei/lOWbnueahOaVsOaNruOAglxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIHJlcXVlc3Q8VCA9ICcnPihwYXJhbXM6IE1ILlJlcXVlc3RQYXJhbXMsIGNhbGxiYWNrPzogTUguUmVxdWVzdENhbGxiYWNrPFQ+KSB7XHJcbiAgICAgICAgY29uc3QgeyBzdWJVcmwsIG1ldGhvZCwgcXVlcnkgPSB7fSwgZGF0YSA9IHt9IH0gPSBwYXJhbXM7XHJcbiAgICAgICAgY29uc3QgaW5uZXJDYWxsYmFjazogTUguR2V0QWNjZXNzVG9rZW5DYWxsYmFjayA9IChlcnIsIHRva2VuKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHRva2VuKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBxdWVyeS5hY2Nlc3NfdG9rZW4gPSB0b2tlbi5hY2Nlc3NUb2tlbjtcclxuICAgICAgICAgICAgd3gucmVxdWVzdCh7XHJcbiAgICAgICAgICAgICAgICB1cmw6IGAke1VSTF9QUkVGSVh9JHtzdWJVcmx9JHtzdWJVcmwuaW5jbHVkZXMoJz8nKSA/ICcmJyA6ICc/J30ke01ILnN0cmluZ2lmeVF1ZXJ5U3RyaW5nKHF1ZXJ5KX1gLFxyXG4gICAgICAgICAgICAgICAgbWV0aG9kLFxyXG4gICAgICAgICAgICAgICAgZGF0YSxcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IChyZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBjb25zdCBkYXRhID0gcmVzdWx0LmRhdGEgYXMgVDtcclxuICAgICAgICAgICAgICAgICAgICAvLyDlpoLmnpzov5Tlm54yMDTpgqPkuYhkYXRh5piv56m65a2X56ym5LiyXHJcbiAgICAgICAgICAgICAgICAgICAgaWYgKE1ILmlzUmVtb3RlRXJyb3IoZGF0YSkpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGRhdGEuY29kZSA9PT0gJ0ludmFsaWRBY2Nlc3NUb2tlbicpIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4obnVsbCk7XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5lbnN1cmVUb2tlbihpbm5lckNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUmVtb3RlRXJyb3IocmVzdWx0LnN0YXR1c0NvZGUsIGRhdGEuY29kZSwgZGF0YS5tZXNzYWdlKSk7XHJcbiAgICAgICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMudXBkYXRlVG9rZW4oKTtcclxuICAgICAgICAgICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogcmVzdWx0LnN0YXR1c0NvZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGRhdGEsXHJcbiAgICAgICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgZmFpbDogKHJlcykgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIGNhbGxiYWNrPy4obmV3IE1ILld4UmVxdWVzdEVycm9yKHJlcy5lcnJNc2cpKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0pO1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgdGhpcy5lbnN1cmVUb2tlbihpbm5lckNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIm+W7uuenn+aIt+epuumXtOOAguWcqOWIm+W7uuaIkOWKn+WQju+8jOW9k+WJjeWunuS+i+eahOenn+aIt+epuumXtCBJRCDlsIboh6rliqjmjIflkJHmlrDliJvlu7rnmoTnp5/miLfnqbrpl7TjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDliJvlu7rlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/liJvlu7rnmoTnp5/miLfnqbrpl7TnmoTnm7jlhbPkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgY3JlYXRlU3BhY2UoY2FsbGJhY2s/OiBNSC5DcmVhdGVTcGFjZUNhbGxiYWNrKTogdm9pZFxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7rlhbfmnInmjIflrprmianlsZXpgInpobnnmoTnp5/miLfnqbrpl7TjgILlnKjliJvlu7rmiJDlip/lkI7vvIzlvZPliY3lrp7kvovnmoTnp5/miLfnqbrpl7QgSUQg5bCG6Ieq5Yqo5oyH5ZCR5paw5Yib5bu655qE56ef5oi356m66Ze044CCXHJcbiAgICAgKiBAcGFyYW0gZXh0ZW5zaW9uIOenn+aIt+epuumXtOaJqeWxlemAiemhuVxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWIm+W7uuWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WIm+W7uueahOenn+aIt+epuumXtOeahOebuOWFs+S/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICBjcmVhdGVTcGFjZShleHRlbnNpb24/OiBNSC5TcGFjZUV4dGVuc2lvbiwgY2FsbGJhY2s/OiBNSC5DcmVhdGVTcGFjZUNhbGxiYWNrKTogdm9pZFxyXG4gICAgY3JlYXRlU3BhY2UoZXh0ZW5zaW9uPzogTUguU3BhY2VFeHRlbnNpb24gfCBNSC5DcmVhdGVTcGFjZUNhbGxiYWNrLCBjYWxsYmFjaz86IE1ILkNyZWF0ZVNwYWNlQ2FsbGJhY2spIHtcclxuICAgICAgICBjb25zdCBwYXJhbXM6IE1ILlJlcXVlc3RQYXJhbXMgPSB7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9zcGFjZS8ke3RoaXMubGlicmFyeUlkfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgIH07XHJcbiAgICAgICAgaWYgKHR5cGVvZiBleHRlbnNpb24gPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sgPSBleHRlbnNpb247XHJcbiAgICAgICAgICAgIGV4dGVuc2lvbiA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGV4dGVuc2lvbikge1xyXG4gICAgICAgICAgICBwYXJhbXMuZGF0YSA9IGV4dGVuc2lvbjtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0PE1ILkNyZWF0ZVNwYWNlUmVzdWx0PihwYXJhbXMsIChlcnIsIHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCByZXN1bHQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuc3BhY2VJZCA9IHJlc3VsdC5kYXRhLnNwYWNlSWQ7XHJcbiAgICAgICAgICAgIGNhbGxiYWNrPy4obnVsbCwgcmVzdWx0KTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICog5L+u5pS556ef5oi356m66Ze055qE6YOo5YiG5omp5bGV6YCJ6aG5XHJcbiAgICAqIEBwYXJhbSBleHRlbnNpb24g6ZyA6KaB5L+u5pS555qE5omp5bGV6YCJ6aG577yM5Y+q5pyJ6YOo5YiG6YCJ6aG55pSv5oyB5L+u5pS55LiU5LuF5Zyo6K+l5Y+C5pWw5Lit5Ye6546w55qE6YCJ6aG55Lya6KKr5L+u5pS544CCXHJcbiAgICAqIEBwYXJhbSBjYWxsYmFjayDkv67mlLnlrozmiJDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/jgIJcclxuICAgICovXHJcbiAgICB1cGRhdGVTcGFjZUV4dGVuc2lvbihleHRlbnNpb246IE1ILkFsbG93TW9kaWZpZWRTcGFjZUV4dGVuc2lvbiwgY2FsbGJhY2s/OiBNSC5SZXF1ZXN0Q2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLnJlcXVlc3Qoe1xyXG4gICAgICAgICAgICBzdWJVcmw6IGAvc3BhY2UvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9L2V4dGVuc2lvbmAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgICAgICBkYXRhOiBleHRlbnNpb24sXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5Yig6Zmk56ef5oi356m66Ze044CC5Zyo5Yig6Zmk5oiQ5Yqf5ZCO77yM5b2T5YmN5a6e5L6L55qE56ef5oi356m66Ze0IElEIOWwhuiHquWKqOe9ruepuu+8jOmcgOimgemHjeaWsOWIm+W7uuaWsOeahOenn+aIt+epuumXtOaIluaJi+WKqOaMh+WQkeWFtuS7lueahOenn+aIt+epuumXtOOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWIoOmZpOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+OAglxyXG4gICAgICovXHJcbiAgICBkZWxldGVTcGFjZShjYWxsYmFjaz86IE1ILlJlcXVlc3RDYWxsYmFjaykge1xyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9zcGFjZS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdERUxFVEUnLFxyXG4gICAgICAgIH0sIChlcnIsIHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCByZXN1bHQpKSB7XHJcbiAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMuc3BhY2VJZCA9ICcnO1xyXG4gICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHJlc3VsdCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliIbpobXliJflh7rmjIflrprnm67lvZXkuK3nmoTlhoXlrrlcclxuICAgICAqIEBwYXJhbSBwYXJhbXMg5YiG6aG15YiX5Ye655uu5b2V5Y+C5pWwXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5YiX5Ye655qE55uu5b2V5YaF5a655L+h5oGv44CCXHJcbiAgICAgKi9cclxuICAgIGxpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvbihwYXJhbXM6IE1ILkxpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvblBhcmFtcywgY2FsbGJhY2s/OiBNSC5MaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25DYWxsYmFjaykge1xyXG4gICAgICAgIGNvbnN0IHsgcGF0aCwgbWFya2VyLCBsaW1pdCB9ID0gcGFyYW1zO1xyXG4gICAgICAgIHRoaXMucmVxdWVzdDxMaXN0RGlyZWN0b3J5UmVzdWx0SW5uZXI+KHtcclxuICAgICAgICAgICAgc3ViVXJsOiBgL2RpcmVjdG9yeS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vJHtwYXRoID8gTUguZW5jb2RlUGF0aChwYXRoKSA6ICcnfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ0dFVCcsXHJcbiAgICAgICAgICAgIHF1ZXJ5OiB7IG1hcmtlciwgbGltaXQgfSxcclxuICAgICAgICB9LCAoZXJyLCByZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgcmVzdWx0KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCBjb250ZW50czogTUguRGlyZWN0b3J5Q29udGVudFtdID0gW107XHJcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgcmVzdWx0LmRhdGEuY29udGVudHMpIHtcclxuICAgICAgICAgICAgICAgICAgICBjb250ZW50cy5wdXNoKHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogaXRlbS5uYW1lLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICB0eXBlOiBpdGVtLnR5cGUsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNyZWF0aW9uVGltZTogbmV3IERhdGUoaXRlbS5jcmVhdGlvblRpbWUpLFxyXG4gICAgICAgICAgICAgICAgICAgIH0pO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCB7XHJcbiAgICAgICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogcmVzdWx0LnN0YXR1c0NvZGUsXHJcbiAgICAgICAgICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICBwYXRoOiByZXN1bHQuZGF0YS5wYXRoLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBuZXh0TWFya2VyOiByZXN1bHQuZGF0YS5uZXh0TWFya2VyLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICBjb250ZW50cyxcclxuICAgICAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIl+WHuuagueebruW9leS4reeahOWGheWuue+8jOivpeaWueazleWwhuiHquWKqOS7juesrCAxIOmhteW8gOWni+WIl+WHuuagueebruW9leebtOWIsOaJgOaciemhteWdh+WIl+WHuuOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+WIl+WHuueahOebruW9leWGheWuueS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICBsaXN0RGlyZWN0b3J5KGNhbGxiYWNrPzogTUguTGlzdERpcmVjdG9yeUNhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog5YiX5Ye65oyH5a6a55uu5b2V5Lit55qE5YaF5a6577yM6K+l5pa55rOV5bCG6Ieq5Yqo5LuO56ysIDEg6aG15byA5aeL5YiX5Ye65oyH5a6a55uu5b2V55u05Yiw5omA5pyJ6aG15Z2H5YiX5Ye644CCXHJcbiAgICAgKiBAcGFyYW0gcGF0aCDnm67lvZXot6/lvoRcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/liJflh7rnmoTnm67lvZXlhoXlrrnkv6Hmga/jgIJcclxuICAgICAqL1xyXG4gICAgbGlzdERpcmVjdG9yeShwYXRoOiBzdHJpbmcsIGNhbGxiYWNrPzogTUguTGlzdERpcmVjdG9yeUNhbGxiYWNrKTogdm9pZDtcclxuICAgIGxpc3REaXJlY3RvcnkocGF0aD86IHN0cmluZyB8IE1ILkxpc3REaXJlY3RvcnlDYWxsYmFjaywgY2FsbGJhY2s/OiBNSC5MaXN0RGlyZWN0b3J5Q2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIHBhdGggPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sgPSBwYXRoO1xyXG4gICAgICAgICAgICBwYXRoID0gdm9pZCAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBpbm5lclBhdGggPSBwYXRoIHx8ICcnO1xyXG4gICAgICAgIGxldCByZXR1cm5QYXRoOiBzdHJpbmdbXSA9IFtdO1xyXG4gICAgICAgIGxldCBjb250ZW50czogTUguRGlyZWN0b3J5Q29udGVudFtdID0gW107XHJcbiAgICAgICAgbGV0IG1hcmtlcjogbnVtYmVyIHwgdW5kZWZpbmVkID0gdm9pZCAwO1xyXG4gICAgICAgIGxldCByZXRyaWVkVGltZXMgPSAwO1xyXG4gICAgICAgIGxldCBpbm5lckNhbGxiYWNrOiBNSC5MaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25DYWxsYmFjayA9IChlcnIsIHJlc3VsdCkgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCByZXN1bHQpKSB7XHJcbiAgICAgICAgICAgICAgICBpZiAocmV0cmllZFRpbWVzID49IDIgfHwgKGVyciBpbnN0YW5jZW9mIE1ILkdldEFjY2Vzc1Rva2VuRXJyb3IpIHx8XHJcbiAgICAgICAgICAgICAgICAgICAgKGVyciBpbnN0YW5jZW9mIE1ILlJlbW90ZUVycm9yKSAmJiAoZXJyLnN0YXR1cyA9PT0gNDAzIHx8IGVyci5zdGF0dXMgPT09IDQwNCkpIHtcclxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihlcnIpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgcmV0cmllZFRpbWVzKys7XHJcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocmVzdWx0KSB7XHJcbiAgICAgICAgICAgICAgICByZXRyaWVkVGltZXMgPSAwO1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuUGF0aCA9IHJlc3VsdC5kYXRhLnBhdGg7XHJcbiAgICAgICAgICAgICAgICBjb250ZW50cyA9IGNvbnRlbnRzLmNvbmNhdChyZXN1bHQuZGF0YS5jb250ZW50cyk7XHJcbiAgICAgICAgICAgICAgICBpZiAocmVzdWx0LmRhdGEubmV4dE1hcmtlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIG1hcmtlciA9IHJlc3VsdC5kYXRhLm5leHRNYXJrZXI7XHJcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG51bGwsIHsgcGF0aDogcmV0dXJuUGF0aCwgY29udGVudHMgfSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy5saXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb24oeyBwYXRoOiBpbm5lclBhdGgsIG1hcmtlciB9LCBpbm5lckNhbGxiYWNrKTtcclxuICAgICAgICB9O1xyXG4gICAgICAgIGlubmVyQ2FsbGJhY2sobnVsbCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDliJvlu7rnm67lvZVcclxuICAgICAqIEBwYXJhbSBwYXRoIOebruW9lei3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWIm+W7uuWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+OAglxyXG4gICAgICovXHJcbiAgICBjcmVhdGVEaXJlY3RvcnkocGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILlJlcXVlc3RDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICghcGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gcGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9kaXJlY3RvcnkvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7TUguZW5jb2RlUGF0aChwYXRoKX1gLFxyXG4gICAgICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIoOmZpOaMh+WumuebruW9lVxyXG4gICAgICogQHBhcmFtIHBhdGgg55uu5b2V6Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Yig6Zmk5a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf44CCXHJcbiAgICAgKi9cclxuICAgIGRlbGV0ZURpcmVjdG9yeShwYXRoOiBzdHJpbmcsIGNhbGxiYWNrPzogTUguUmVxdWVzdENhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKCFwYXRoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5QYXJhbUVycm9yKCdQYXJhbSBwYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICAgICAgc3ViVXJsOiBgL2RpcmVjdG9yeS8ke3RoaXMubGlicmFyeUlkfS8ke3RoaXMuc3BhY2VJZH0vJHtNSC5lbmNvZGVQYXRoKHBhdGgpfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ0RFTEVURScsXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6YeN5ZG95ZCN5oiW56e75Yqo5oyH5a6a55uu5b2VXHJcbiAgICAgKiBAcGFyYW0gZnJvbVBhdGgg5rqQ55uu5b2V5a6M5pW06Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gdG9QYXRoIOebruagh+ebruW9leWujOaVtOi3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOmHjeWRveWQjeaIluenu+WKqOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+OAglxyXG4gICAgICovXHJcbiAgICBtb3ZlRGlyZWN0b3J5KGZyb21QYXRoOiBzdHJpbmcsIHRvUGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILlJlcXVlc3RDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICghZnJvbVBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIGZyb21QYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKCF0b1BhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIHRvUGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9kaXJlY3RvcnkvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7TUguZW5jb2RlUGF0aCh0b1BhdGgpfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BVVCcsXHJcbiAgICAgICAgICAgIGRhdGE6IHtcclxuICAgICAgICAgICAgICAgIGZyb206IGZyb21QYXRoXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5aqS5L2T5bqT5oyH5a6a55u457C/55qE5bCB6Z2i5Zu+54mHIFVSTFxyXG4gICAgICogQHBhcmFtIGFsYnVtTmFtZSDnm7jnsL/lkI3vvIzlr7nkuo7pnZ7lpJrnm7jnsL/mqKHlvI/lj6/mjIflrprnqbrlrZfnrKbkuLLojrflj5bmlbTkuKrnqbrpl7TnmoTlsIHpnaLlm77jgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTnm7jnsL/lsIHpnaLlm77niYcgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldENvdmVyVXJsKGFsYnVtTmFtZTogc3RyaW5nLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog6I635Y+W5aqS5L2T5bqT5oyH5a6a55u457C/55qE5oyH5a6a5aSn5bCP55qE5bCB6Z2i5Zu+54mHIFVSTFxyXG4gICAgICogQHBhcmFtIGFsYnVtTmFtZSDnm7jnsL/lkI3vvIzlr7nkuo7pnZ7lpJrnm7jnsL/mqKHlvI/lj6/mjIflrprnqbrlrZfnrKbkuLLojrflj5bmlbTkuKrnqbrpl7TnmoTlsIHpnaLlm77jgIJcclxuICAgICAqIEBwYXJhbSBzaXplIOWwgemdouWbvueJh+Wkp+WwjyhweCnvvIzlsIbnvKnmlL7oo4HliarkuLrmraPmlrnlvaLlm77niYfjgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTnm7jnsL/lsIHpnaLlm77niYcgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldENvdmVyVXJsKGFsYnVtTmFtZTogc3RyaW5nLCBzaXplOiBudW1iZXIsIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDmibnph4/ojrflj5blqpLkvZPlupPmjIflrprnm7jnsL/nmoTlsIHpnaLlm77niYcgVVJMXHJcbiAgICAgKiBAcGFyYW0gYWxidW1OYW1lTGlzdCDnm7jnsL/lkI3liJfooajvvIzlr7nkuo7pnZ7lpJrnm7jnsL/mqKHlvI/lj6/mjIflrprnqbrlrZfnrKbkuLLojrflj5bmlbTkuKrnqbrpl7TnmoTlsIHpnaLlm77jgIJcclxuICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzov5Tlm57mmK/lkKbmiJDlip/lj4rmiJDlip/ojrflj5bnmoTnm7jnsL/lsIHpnaLlm77niYcgVVJM44CCXHJcbiAgICAgKi9cclxuICAgIGdldENvdmVyVXJsKGFsYnVtTmFtZUxpc3Q6IHN0cmluZ1tdLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog5om56YeP6I635Y+W5aqS5L2T5bqT5oyH5a6a55u457C/55qE5oyH5a6a5aSn5bCP55qE5bCB6Z2i5Zu+54mHIFVSTFxyXG4gICAgICogQHBhcmFtIGFsYnVtTmFtZUxpc3Qg55u457C/5ZCN5YiX6KGo77yM5a+55LqO6Z2e5aSa55u457C/5qih5byP5Y+v5oyH5a6a56m65a2X56ym5Liy6I635Y+W5pW05Liq56m66Ze055qE5bCB6Z2i5Zu+44CCXHJcbiAgICAgKiBAcGFyYW0gc2l6ZSDlsIHpnaLlm77niYflpKflsI8ocHgp77yM5bCG57yp5pS+6KOB5Ymq5Li65q2j5pa55b2i5Zu+54mH44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE55u457C/5bCB6Z2i5Zu+54mHIFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRDb3ZlclVybChhbGJ1bU5hbWVMaXN0OiBzdHJpbmdbXSwgc2l6ZTogbnVtYmVyLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIGdldENvdmVyVXJsKGFsYnVtTmFtZUxpc3Q6IHN0cmluZyB8IHN0cmluZ1tdLCBzaXplPzogbnVtYmVyIHwgTUguR2V0VXJsQ2FsbGJhY2ssIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spIHtcclxuICAgICAgICB0aGlzLmVuc3VyZVRva2VuKHRydWUsIChlcnIsIHRva2VuKSA9PiB7XHJcbiAgICAgICAgICAgIGlmIChNSC5oYXNFcnJvcihlcnIsIHRva2VuKSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoIUFycmF5LmlzQXJyYXkoYWxidW1OYW1lTGlzdCkpIHtcclxuICAgICAgICAgICAgICAgIGFsYnVtTmFtZUxpc3QgPSBbYWxidW1OYW1lTGlzdF07XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzaXplID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IHNpemU7XHJcbiAgICAgICAgICAgICAgICBzaXplID0gdm9pZCAwO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5OiBNSC5RdWVyeSA9IHtcclxuICAgICAgICAgICAgICAgIGFjY2Vzc190b2tlbjogdG9rZW4uYWNjZXNzVG9rZW4sXHJcbiAgICAgICAgICAgICAgICBzaXplLFxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICBjb25zdCB1cmxzID0gYWxidW1OYW1lTGlzdC5tYXAoYWxidW1OYW1lID0+IGAke1VSTF9QUkVGSVh9L2FsYnVtLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS9jb3ZlciR7YWxidW1OYW1lID8gJy8nICsgTUguZW5jb2RlUGF0aChhbGJ1bU5hbWUpIDogJyd9PyR7TUguc3RyaW5naWZ5UXVlcnlTdHJpbmcocXVlcnkpfWApO1xyXG4gICAgICAgICAgICBjYWxsYmFjaz8uKG51bGwsIHVybHMpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgZ2V0RmlsZVVybFdpdGhRdWVyeShwYXRoTGlzdDogc3RyaW5nIHwgc3RyaW5nW10sIHF1ZXJ5OiBNSC5RdWVyeSwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICh0eXBlb2YgcGF0aExpc3QgPT09ICdzdHJpbmcnICYmICFwYXRoTGlzdCB8fCBBcnJheS5pc0FycmF5KHBhdGhMaXN0KSAmJiAhcGF0aExpc3QubGVuZ3RoKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKG5ldyBNSC5QYXJhbUVycm9yKCdQYXJhbSBwYXRoL3BhdGhMaXN0IGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5lbnN1cmVUb2tlbih0cnVlLCAoZXJyLCB0b2tlbikgPT4ge1xyXG4gICAgICAgICAgICBpZiAoTUguaGFzRXJyb3IoZXJyLCB0b2tlbikpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjaz8uKGVycik7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKCFBcnJheS5pc0FycmF5KHBhdGhMaXN0KSkge1xyXG4gICAgICAgICAgICAgICAgcGF0aExpc3QgPSBbcGF0aExpc3RdO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGNvbnN0IHVybHMgPSBwYXRoTGlzdC5tYXAocGF0aCA9PiBgJHtVUkxfUFJFRklYfS9maWxlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgocGF0aCl9PyR7TUguc3RyaW5naWZ5UXVlcnlTdHJpbmcoe1xyXG4gICAgICAgICAgICAgICAgLi4ucXVlcnksXHJcbiAgICAgICAgICAgICAgICBhY2Nlc3NfdG9rZW46IHRva2VuLmFjY2Vzc1Rva2VuLFxyXG4gICAgICAgICAgICB9KX1gKTtcclxuICAgICAgICAgICAgY2FsbGJhY2s/LihudWxsLCB1cmxzKTtcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluaMh+WumuaWh+S7tiBVUkxcclxuICAgICAqIEBwYXJhbSBwYXRoIOaWh+S7tui3r+W+hFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0RmlsZVVybChwYXRoOiBzdHJpbmcsIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDmibnph4/ojrflj5bmjIflrprmlofku7YgVVJMXHJcbiAgICAgKiBAcGFyYW0gcGF0aExpc3Qg5paH5Lu26Lev5b6E5YiX6KGoXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE5paH5Lu2IFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRGaWxlVXJsKHBhdGhMaXN0OiBzdHJpbmdbXSwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICBnZXRGaWxlVXJsKHBhdGhMaXN0OiBzdHJpbmcgfCBzdHJpbmdbXSwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjaykge1xyXG4gICAgICAgIHRoaXMuZ2V0RmlsZVVybFdpdGhRdWVyeShwYXRoTGlzdCwge30sIGNhbGxiYWNrKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluaMh+WumueFp+eJhyBVUkwg5oiW6KeG6aKR55qE5bCB6Z2iIFVSTFxyXG4gICAgICogQHBhcmFtIHBhdGgg5paH5Lu26Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE5paH5Lu2IFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRQcmV2aWV3VXJsKHBhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOiOt+WPluaMh+WumuWqkuS9k+aWh+S7tueahOaMh+WumuWkp+Wwj+eahOe8qeeVpeWbviBVUkxcclxuICAgICAqIEBwYXJhbSBwYXRoIOaWh+S7tui3r+W+hFxyXG4gICAgICogQHBhcmFtIHNpemUg57yp55Wl5Zu+5aSn5bCPKHB4Ke+8jOWwhue8qeaUvuijgeWJquS4uuato+aWueW9ouWbvueJh+OAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0UHJldmlld1VybChwYXRoOiBzdHJpbmcsIHNpemU6IG51bWJlciwgY2FsbGJhY2s/OiBNSC5HZXRVcmxDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOaJuemHj+iOt+WPluaMh+WumueFp+eJhyBVUkwg5oiW6KeG6aKR55qE5bCB6Z2iIFVSTFxyXG4gICAgICogQHBhcmFtIHBhdGhMaXN0IOaWh+S7tui3r+W+hOWIl+ihqFxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+iOt+WPlueahOaWh+S7tiBVUkzjgIJcclxuICAgICAqL1xyXG4gICAgZ2V0UHJldmlld1VybChwYXRoTGlzdDogc3RyaW5nW10sIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgLyoqXHJcbiAgICAgKiDmibnph4/ojrflj5bmjIflrprlqpLkvZPmlofku7bnmoTmjIflrprlpKflsI/nmoTnvKnnlaXlm74gVVJMXHJcbiAgICAgKiBAcGFyYW0gcGF0aExpc3Qg5paH5Lu26Lev5b6E5YiX6KGoXHJcbiAgICAgKiBAcGFyYW0gc2l6ZSDnvKnnlaXlm77lpKflsI8ocHgp77yM5bCG57yp5pS+6KOB5Ymq5Li65q2j5pa55b2i5Zu+54mH44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6I635Y+W55qE5paH5Lu2IFVSTOOAglxyXG4gICAgICovXHJcbiAgICBnZXRQcmV2aWV3VXJsKHBhdGhMaXN0OiBzdHJpbmdbXSwgc2l6ZTogbnVtYmVyLCBjYWxsYmFjaz86IE1ILkdldFVybENhbGxiYWNrKTogdm9pZDtcclxuICAgIGdldFByZXZpZXdVcmwocGF0aExpc3Q6IHN0cmluZyB8IHN0cmluZ1tdLCBzaXplPzogbnVtYmVyIHwgTUguR2V0VXJsQ2FsbGJhY2ssIGNhbGxiYWNrPzogTUguR2V0VXJsQ2FsbGJhY2spIHtcclxuICAgICAgICBpZiAodHlwZW9mIHNpemUgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgY2FsbGJhY2sgPSBzaXplO1xyXG4gICAgICAgICAgICBzaXplID0gdm9pZCAwO1xyXG4gICAgICAgIH1cclxuICAgICAgICB0aGlzLmdldEZpbGVVcmxXaXRoUXVlcnkocGF0aExpc3QsIHtcclxuICAgICAgICAgICAgcHJldmlldzogJycsXHJcbiAgICAgICAgICAgIHNpemUsXHJcbiAgICAgICAgfSwgY2FsbGJhY2spO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICog5LiK5Lyg5paH5Lu2XHJcbiAgICAgKiBAcGFyYW0gcmVtb3RlUGF0aCDmlofku7bnmoTov5znqIvnm67moIfot6/lvoTvvIzlpoLmnpzmjIflrprot6/lvoTlrZjlnKjlkIzlkI3mlofku7bmiJbnm67lvZXliJnoh6rliqjmlLnlkI3jgIJcclxuICAgICAqIEBwYXJhbSBsb2NhbFBhdGgg5Zyo5b6u5L+h5YaF6I635Y+W55qE5paH5Lu25pys5Zyw6Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5LiK5Lyg5a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf5LiK5Lyg55qE5paH5Lu255qE5L+h5oGv44CCXHJcbiAgICAgKi9cclxuICAgIHVwbG9hZEZpbGUocmVtb3RlUGF0aDogc3RyaW5nLCBsb2NhbFBhdGg6IHN0cmluZywgY2FsbGJhY2s/OiBNSC5VcGxvYWRDYWxsYmFjayk6IHZvaWQ7XHJcbiAgICAvKipcclxuICAgICAqIOS4iuS8oOaWh+S7tuW5tuWPr+aMh+WumumBh+WIsOWQjOWQjeaWh+S7tuaIluebruW9leaXtueahOWkhOeQhuaWueazlVxyXG4gICAgICogQHBhcmFtIHJlbW90ZVBhdGgg5paH5Lu255qE6L+c56iL55uu5qCH6Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gbG9jYWxQYXRoIOWcqOW+ruS/oeWGheiOt+WPlueahOaWh+S7tuacrOWcsOi3r+W+hFxyXG4gICAgICogQHBhcmFtIGZvcmNlIOaYr+WQpuW8uuWItuimhuebluWQjOWQjeaWh+S7tuaIluebruW9le+8jOW9k+mAieaLqeW8uuWItuimhuebluaXtu+8jOWQjOWQjeaWh+S7tuWwhuS8muiiq+WIoOmZpO+8jOWQjOWQjeebruW9leWwhuS8mui/nuWQjOebruW9leWGheWuueS4gOW5tuiiq+WIoOmZpOOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOS4iuS8oOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+S4iuS8oOeahOaWh+S7tueahOS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICB1cGxvYWRGaWxlKHJlbW90ZVBhdGg6IHN0cmluZywgbG9jYWxQYXRoOiBzdHJpbmcsIGZvcmNlOiBib29sZWFuLCBjYWxsYmFjaz86IE1ILlVwbG9hZENhbGxiYWNrKTogdm9pZDtcclxuICAgIHVwbG9hZEZpbGUocmVtb3RlUGF0aDogc3RyaW5nLCBsb2NhbFBhdGg6IHN0cmluZywgZm9yY2U/OiBib29sZWFuIHwgTUguVXBsb2FkQ2FsbGJhY2ssIGNhbGxiYWNrPzogTUguVXBsb2FkQ2FsbGJhY2spIHtcclxuICAgICAgICBpZiAoIXJlbW90ZVBhdGgpIHtcclxuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4obmV3IE1ILlBhcmFtRXJyb3IoJ1BhcmFtIHJlbW90ZVBhdGggaXMgZW1wdHkuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWxvY2FsUGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gbG9jYWxQYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBmb3JjZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBjYWxsYmFjayA9IGZvcmNlO1xyXG4gICAgICAgICAgICBmb3JjZSA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0PE1ILkJlZ2luVXBsb2FkUmVzdWx0Pih7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9maWxlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgocmVtb3RlUGF0aCl9YCxcclxuICAgICAgICAgICAgbWV0aG9kOiAnUE9TVCcsXHJcbiAgICAgICAgICAgIHF1ZXJ5OiB7XHJcbiAgICAgICAgICAgICAgICBmb3JjZTogZm9yY2UgPyAxIDogMCxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LCAoZXJyLCByZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgaWYgKE1ILmhhc0Vycm9yKGVyciwgcmVzdWx0KSkge1xyXG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrPy4oZXJyKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCB7IGRhdGEgfSA9IHJlc3VsdDtcclxuICAgICAgICAgICAgY29uc3QgeyBkb21haW4sIGZvcm0sIGNvbmZpcm1LZXkgfSA9IGRhdGE7XHJcbiAgICAgICAgICAgIHd4LnVwbG9hZEZpbGUoe1xyXG4gICAgICAgICAgICAgICAgdXJsOiBgaHR0cHM6Ly8ke2RvbWFpbn0vYCxcclxuICAgICAgICAgICAgICAgIGZpbGVQYXRoOiBsb2NhbFBhdGgsXHJcbiAgICAgICAgICAgICAgICBuYW1lOiAnZmlsZScsXHJcbiAgICAgICAgICAgICAgICBmb3JtRGF0YTogZm9ybSxcclxuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IChyZXN1bHQpID0+IHtcclxuICAgICAgICAgICAgICAgICAgICBpZiAocmVzdWx0LnN0YXR1c0NvZGUgIT09IDIwNCkge1xyXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguQ29zRXJyb3IocmVzdWx0LmRhdGEpKTtcclxuICAgICAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICAgICAgICAgICAgICAgICAgc3ViVXJsOiBgL2ZpbGUvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7Y29uZmlybUtleX0/Y29uZmlybWAsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgIG1ldGhvZDogJ1BPU1QnLFxyXG4gICAgICAgICAgICAgICAgICAgIH0sIGNhbGxiYWNrKTtcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICBmYWlsOiAocmVzKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2s/LihuZXcgTUguV3hSZXF1ZXN0RXJyb3IocmVzLmVyck1zZykpO1xyXG4gICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSlcclxuICAgICAgICB9KTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWIoOmZpOaMh+WumuaWh+S7tlxyXG4gICAgICogQHBhcmFtIHBhdGgg5paH5Lu26Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg5Yig6Zmk5a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf44CCXHJcbiAgICAgKi9cclxuICAgIGRlbGV0ZUZpbGUocGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILlJlcXVlc3RDYWxsYmFjaykge1xyXG4gICAgICAgIGlmICghcGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gcGF0aCBpcyBlbXB0eS4nKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMucmVxdWVzdCh7XHJcbiAgICAgICAgICAgIHN1YlVybDogYC9maWxlLyR7dGhpcy5saWJyYXJ5SWR9LyR7dGhpcy5zcGFjZUlkfS8ke01ILmVuY29kZVBhdGgocGF0aCl9YCxcclxuICAgICAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcclxuICAgICAgICB9LCBjYWxsYmFjayk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDph43lkb3lkI3miJbnp7vliqjmjIflrprmlofku7ZcclxuICAgICAqIEBwYXJhbSBmcm9tUGF0aCDmupDmlofku7blrozmlbTot6/lvoRcclxuICAgICAqIEBwYXJhbSB0b1BhdGgg55uu5qCH5paH5Lu25a6M5pW06Lev5b6E77yM5aaC5p6c5oyH5a6a6Lev5b6E5a2Y5Zyo5ZCM5ZCN5paH5Lu25oiW55uu5b2V5YiZ6Ieq5Yqo5pS55ZCN44CCXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sg6YeN5ZG95ZCN5oiW56e75Yqo5a6M5oiQ5Zue6LCD5Ye95pWw77yM6L+U5Zue5piv5ZCm5oiQ5Yqf5Y+K5oiQ5Yqf6YeN5ZG95ZCN5oiW56e75Yqo55qE55uu5qCH5paH5Lu25L+h5oGv44CCXHJcbiAgICAgKi9cclxuICAgIG1vdmVGaWxlKGZyb21QYXRoOiBzdHJpbmcsIHRvUGF0aDogc3RyaW5nLCBjYWxsYmFjaz86IE1ILlVwbG9hZENhbGxiYWNrKTogdm9pZDtcclxuICAgIC8qKlxyXG4gICAgICog6YeN5ZG95ZCN5oiW56e75Yqo5oyH5a6a5paH5Lu25bm25Y+v5oyH5a6a6YGH5Yiw5ZCM5ZCN5paH5Lu25oiW55uu5b2V5pe255qE5aSE55CG5pa55rOVXHJcbiAgICAgKiBAcGFyYW0gZnJvbVBhdGgg5rqQ5paH5Lu25a6M5pW06Lev5b6EXHJcbiAgICAgKiBAcGFyYW0gdG9QYXRoIOebruagh+aWh+S7tuWujOaVtOi3r+W+hFxyXG4gICAgICogQHBhcmFtIGZvcmNlIOaYr+WQpuW8uuWItuimhuebluWQjOWQjeaWh+S7tuaIluebruW9le+8jOW9k+mAieaLqeW8uuWItuimhuebluaXtu+8jOWQjOWQjeaWh+S7tuWwhuS8muiiq+WIoOmZpO+8jOWQjOWQjeebruW9leWwhuS8mui/nuWQjOebruW9leWGheWuueS4gOW5tuiiq+WIoOmZpOOAglxyXG4gICAgICogQHBhcmFtIGNhbGxiYWNrIOmHjeWRveWQjeaIluenu+WKqOWujOaIkOWbnuiwg+WHveaVsO+8jOi/lOWbnuaYr+WQpuaIkOWKn+WPiuaIkOWKn+mHjeWRveWQjeaIluenu+WKqOeahOebruagh+aWh+S7tuS/oeaBr+OAglxyXG4gICAgICovXHJcbiAgICBtb3ZlRmlsZShmcm9tUGF0aDogc3RyaW5nLCB0b1BhdGg6IHN0cmluZywgZm9yY2U6IGJvb2xlYW4sIGNhbGxiYWNrPzogTUguVXBsb2FkQ2FsbGJhY2spOiB2b2lkO1xyXG4gICAgbW92ZUZpbGUoZnJvbVBhdGg6IHN0cmluZywgdG9QYXRoOiBzdHJpbmcsIGZvcmNlPzogYm9vbGVhbiB8IE1ILlVwbG9hZENhbGxiYWNrLCBjYWxsYmFjaz86IE1ILlVwbG9hZENhbGxiYWNrKSB7XHJcbiAgICAgICAgaWYgKCFmcm9tUGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gZnJvbVBhdGggaXMgZW1wdHkuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIXRvUGF0aCkge1xyXG4gICAgICAgICAgICByZXR1cm4gY2FsbGJhY2s/LihuZXcgTUguUGFyYW1FcnJvcignUGFyYW0gdG9QYXRoIGlzIGVtcHR5LicpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKHR5cGVvZiBmb3JjZSA9PT0gJ2Z1bmN0aW9uJykge1xyXG4gICAgICAgICAgICBjYWxsYmFjayA9IGZvcmNlO1xyXG4gICAgICAgICAgICBmb3JjZSA9IHZvaWQgMDtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhpcy5yZXF1ZXN0KHtcclxuICAgICAgICAgICAgc3ViVXJsOiBgL2ZpbGUvJHt0aGlzLmxpYnJhcnlJZH0vJHt0aGlzLnNwYWNlSWR9LyR7TUguZW5jb2RlUGF0aCh0b1BhdGgpfWAsXHJcbiAgICAgICAgICAgIG1ldGhvZDogJ1BVVCcsXHJcbiAgICAgICAgICAgIHF1ZXJ5OiB7XHJcbiAgICAgICAgICAgICAgICBmb3JjZTogZm9yY2UgPyAxIDogMCxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgZGF0YToge1xyXG4gICAgICAgICAgICAgICAgZnJvbTogZnJvbVBhdGhcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICB9LCBjYWxsYmFjayk7XHJcbiAgICB9XHJcbn1cclxuXHJcbm5hbWVzcGFjZSBNSCB7XHJcblxyXG4gICAgLyoqIOWcqCBFUzUg5LiL5L+u5aSN5LqG5Y6f5Z6L6ZO+55qE6ZSZ6K+v5Z+657G7ICovXHJcbiAgICBleHBvcnQgY2xhc3MgQmFzZUVycm9yIGV4dGVuZHMgRXJyb3Ige1xyXG4gICAgICAgIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZykge1xyXG4gICAgICAgICAgICBzdXBlcihtZXNzYWdlKTtcclxuICAgICAgICAgICAgdGhpcy5uYW1lID0gbmV3LnRhcmdldC5uYW1lO1xyXG4gICAgICAgICAgICBjb25zdCB7IGNhcHR1cmVTdGFja1RyYWNlIH0gPSBFcnJvciBhcyBhbnk7XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgY2FwdHVyZVN0YWNrVHJhY2UgPT09ICdmdW5jdGlvbicpIHtcclxuICAgICAgICAgICAgICAgIGNhcHR1cmVTdGFja1RyYWNlKHRoaXMsIG5ldy50YXJnZXQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmICh0eXBlb2YgT2JqZWN0LnNldFByb3RvdHlwZU9mID09PSAnZnVuY3Rpb24nKSB7XHJcbiAgICAgICAgICAgICAgICBPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcywgbmV3LnRhcmdldC5wcm90b3R5cGUpO1xyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgKHRoaXMgYXMgYW55KS5fX3Byb3RvX18gPSBuZXcudGFyZ2V0LnByb3RvdHlwZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKirlj4LmlbDplJnor68gKi9cclxuICAgIGV4cG9ydCBjbGFzcyBQYXJhbUVycm9yIGV4dGVuZHMgQmFzZUVycm9yIHsgfVxyXG5cclxuICAgIC8qKiDpgJrov4flvq7kv6HmjqXlj6Plj5Hotbfor7fmsYLml7blj5HnlJ/plJnor68gKi9cclxuICAgIGV4cG9ydCBjbGFzcyBXeFJlcXVlc3RFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7IH1cclxuXHJcbiAgICAvKiog6I635Y+W6K6/6Zeu5Luk54mM5pe25Lia5Yqh5L6n5Y+R55Sf6ZSZ6K+vICovXHJcbiAgICBleHBvcnQgY2xhc3MgR2V0QWNjZXNzVG9rZW5FcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XHJcblxyXG4gICAgICAgIC8qKiDojrflj5borr/pl67ku6TniYzml7bkuJrliqHkvqfov5Tlm57nmoTplJnor68gKi9cclxuICAgICAgICBwdWJsaWMgcmVhZG9ubHkgbmVzdGVkRXJyb3I6IEVycm9yIHwgbnVsbDtcclxuXHJcbiAgICAgICAgY29uc3RydWN0b3IobmVzdGVkRXJyb3I6IEVycm9yIHwgbnVsbCkge1xyXG4gICAgICAgICAgICBzdXBlcihuZXN0ZWRFcnJvcj8ubWVzc2FnZSB8fCAnQW4gZXJyb3Igb2NjdXJlZCB3aGlsZSBnZXR0aW5nIGFjY2VzcyB0b2tlbicpO1xyXG4gICAgICAgICAgICB0aGlzLm5lc3RlZEVycm9yID0gbmVzdGVkRXJyb3I7XHJcbiAgICAgICAgICAgIGlmIChuZXN0ZWRFcnJvcikge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5zdGFjayA9IG5lc3RlZEVycm9yLnN0YWNrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKiDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHplJnor68gKi9cclxuICAgIGV4cG9ydCBjbGFzcyBSZW1vdGVFcnJvciBleHRlbmRzIEJhc2VFcnJvciB7XHJcblxyXG4gICAgICAgIC8qKiBIVFRQIOeKtuaAgeeggSAqL1xyXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBzdGF0dXM6IG51bWJlcjtcclxuXHJcbiAgICAgICAgLyoqIOmUmeivr+eggSAqL1xyXG4gICAgICAgIHB1YmxpYyByZWFkb25seSBjb2RlOiBzdHJpbmc7XHJcblxyXG4gICAgICAgIC8qKiBcclxuICAgICAgICAgKiDlrp7kvovljJblqpLotYTmiZjnrqHlkI7nq6/mnI3liqHplJnor69cclxuICAgICAgICAgKiBAcGFyYW0gc3RhdHVzIEhUVFAg54q25oCB56CBXHJcbiAgICAgICAgICogQHBhcmFtIGNvZGUg6ZSZ6K+v56CBXHJcbiAgICAgICAgICogQHBhcmFtIG1lc3NhZ2Ug6ZSZ6K+v5L+h5oGvXHJcbiAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25zdHJ1Y3RvcihzdGF0dXM6IG51bWJlciwgY29kZTogc3RyaW5nLCBtZXNzYWdlOiBzdHJpbmcpIHtcclxuICAgICAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICAgICAgICAgIHRoaXMuc3RhdHVzID0gc3RhdHVzO1xyXG4gICAgICAgICAgICB0aGlzLmNvZGUgPSBjb2RlO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKiog5a+56LGh5a2Y5YKo5ZCO56uv5pyN5Yqh6ZSZ6K+vICovXHJcbiAgICBleHBvcnQgY2xhc3MgQ29zRXJyb3IgZXh0ZW5kcyBCYXNlRXJyb3Ige1xyXG5cclxuICAgICAgICAvKiog6ZSZ6K+v56CBICovXHJcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IGNvZGU6IHN0cmluZztcclxuICAgICAgICAvKiog6K+35rGCIElEICovXHJcbiAgICAgICAgcHVibGljIHJlYWRvbmx5IHJlcXVlc3RJZDogc3RyaW5nO1xyXG5cclxuICAgICAgICAvKiogXHJcbiAgICAgICAgICog5a6e5L6L5YyW5a+56LGh5a2Y5YKo5ZCO56uv5pyN5Yqh6ZSZ6K+vXHJcbiAgICAgICAgICogQHBhcmFtIGVycm9yWG1sIOWvueixoeWtmOWCqOWQjuerr+acjeWKoei/lOWbnueahOWMheWQq+mUmeivr+S/oeaBr+eahCBYTUwg5a2X56ym5LiyXHJcbiAgICAgICAgICogQHByaXZhdGVcclxuICAgICAgICAgKi9cclxuICAgICAgICBjb25zdHJ1Y3RvcihlcnJvclhtbDogc3RyaW5nID0gJycpIHtcclxuICAgICAgICAgICAgY29uc3QgY29kZSA9IC88Q29kZT4oW148XSspPFxcL0NvZGU+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgY29uc3QgbWVzc2FnZSA9IC88TWVzc2FnZT4oW148XSspPFxcL01lc3NhZ2U+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgY29uc3QgcmVxdWVzdElkID0gLzxSZXF1ZXN0SWQ+KFtePF0rKTxcXC9SZXF1ZXN0SWQ+L2kuZXhlYyhlcnJvclhtbCk/LlsxXSB8fCAnJztcclxuICAgICAgICAgICAgc3VwZXIobWVzc2FnZSk7XHJcbiAgICAgICAgICAgIHRoaXMuY29kZSA9IGNvZGU7XHJcbiAgICAgICAgICAgIHRoaXMucmVxdWVzdElkID0gcmVxdWVzdElkO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOmAmueUqOWbnuiwg+aWueazlVxyXG4gICAgICogQHR5cGVwYXJhbSBUIOaIkOWKn+Wbnuiwg+aXtueahOWbnuiwg+WAvOeahOexu+Wei1xyXG4gICAgICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEdlbmVyYWxDYWxsYmFjazxUPiB7XHJcbiAgICAgICAgLyoqXHJcbiAgICAgICAgICogQHBhcmFtIGVyciDplJnor6/miJYgbnVsbO+8jOW9k+S4uiBudWxsIOaXtuS7o+ihqOaIkOWKn+Wbnuiwg+OAglxyXG4gICAgICAgICAqIEBwYXJhbSByZXN1bHQg5oiQ5Yqf5Zue6LCD5pe255qE5Zue6LCD5YC8XHJcbiAgICAgICAgICovXHJcbiAgICAgICAgKGVycjogRXJyb3IgfCBudWxsLCByZXN1bHQ/OiBUKTogdm9pZDtcclxuICAgIH1cclxuXHJcbiAgICAvKiog6K6/6Zeu5Luk54mM5L+h5oGvICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEFjY2Vzc1Rva2VuIHtcclxuICAgICAgICAvKiog6K6/6Zeu5Luk54mMICovXHJcbiAgICAgICAgYWNjZXNzVG9rZW46IHN0cmluZztcclxuICAgICAgICAvKiog5pyJ5pWI5pe26ZW/77yI5Y2V5L2N77ya56eS77yJICovXHJcbiAgICAgICAgZXhwaXJlc0luOiBudW1iZXI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWPr+eUqOS6juWkmuS4quaMh+Wumuenn+aIt+epuumXtOeahOiuv+mXruS7pOeJjOS/oeaBryAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBNdWx0aVNwYWNlQWNjZXNzVG9rZW4ge1xyXG4gICAgICAgIFtzcGFjZUlkOiBzdHJpbmddOiBBY2Nlc3NUb2tlbjtcclxuICAgIH1cclxuXHJcbiAgICAvKiog5a6M5oiQ6I635Y+W6K6/6Zeu5Luk54mM5Ye95pWw55qE5Zue6LCD5Ye95pWwICovXHJcbiAgICBleHBvcnQgdHlwZSBHZXRBY2Nlc3NUb2tlbkNhbGxiYWNrID0gR2VuZXJhbENhbGxiYWNrPEFjY2Vzc1Rva2VuPjtcclxuXHJcbiAgICAvKiog5a6M5oiQ6I635Y+W5Y+v55So5LqO5aSa5Liq5oyH5a6a56ef5oi356m66Ze055qE6K6/6Zeu5Luk54mM5Ye95pWw55qE5Zue6LCD5Ye95pWwICovXHJcbiAgICBleHBvcnQgdHlwZSBHZXRNdWx0aVNwYWNlQWNjZXNzVG9rZW5DYWxsYmFjayA9IEdlbmVyYWxDYWxsYmFjazxNdWx0aVNwYWNlQWNjZXNzVG9rZW4+O1xyXG5cclxuICAgIC8qKiDojrflj5borr/pl67ku6TniYzlh73mlbDnmoTlj4LmlbAgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgR2V0QWNjZXNzVG9rZW5GdW5jUGFyYW1zIHtcclxuICAgICAgICAvKiog5aqS5L2T5bqTIElEICovXHJcbiAgICAgICAgbGlicmFyeUlkOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtCBJRCAqL1xyXG4gICAgICAgIHNwYWNlSWQ6IHN0cmluZztcclxuICAgICAgICAvKiog55So5oi3IElEICovXHJcbiAgICAgICAgdXNlcklkOiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOiOt+WPluWPr+eUqOS6juWkmuS4quaMh+Wumuenn+aIt+epuumXtOeahOiuv+mXruS7pOeJjOWHveaVsOeahOWPguaVsCAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBHZXRNdWx0aVNwYWNlQWNjZXNzVG9rZW5GdW5jUGFyYW1zIHtcclxuICAgICAgICAvKiog5aqS5L2T5bqTIElEICovXHJcbiAgICAgICAgbGlicmFyeUlkOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtCBJRCDliJfooaggKi9cclxuICAgICAgICBzcGFjZUlkTGlzdDogc3RyaW5nW107XHJcbiAgICAgICAgLyoqIOeUqOaItyBJRCAqL1xyXG4gICAgICAgIHVzZXJJZDogc3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDojrflj5borr/pl67ku6TniYzlh73mlbAgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgR2V0QWNjZXNzVG9rZW5GdW5jIHtcclxuICAgICAgICAvKipcclxuICAgICAgICAgKiBAcGFyYW0gcGFyYW1zIOiOt+WPluiuv+mXruS7pOeJjOWHveaVsOeahOWPguaVsFxyXG4gICAgICAgICAqIEBwYXJhbSBjYWxsYmFjayDlm57osIPlh73mlbDvvIzlnKjkuJrliqHmlrnlrozmiJDku6TniYzojrflj5blkI7osIPnlKjor6Xlm57osIPlh73mlbDlsIbku6TniYzkv6Hmga/ov5Tlm57nu5nlqpLkvZPmiZjnrqHlrqLmiLfnq69cclxuICAgICAgICAgKi9cclxuICAgICAgICAocGFyYW1zOiBHZXRBY2Nlc3NUb2tlbkZ1bmNQYXJhbXMsIGNhbGxiYWNrOiBHZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKTogdm9pZDtcclxuICAgIH1cclxuXHJcbiAgICAvKiog6I635Y+W5Y+v55So5LqO5aSa5Liq5oyH5a6a56ef5oi356m66Ze055qE6K6/6Zeu5Luk54mM5Ye95pWwICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIEdldE11bHRpU3BhY2VBY2Nlc3NUb2tlbkZ1bmMge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIEBwYXJhbSBwYXJhbXMg6I635Y+W5Y+v55So5LqO5aSa5Liq5oyH5a6a56ef5oi356m66Ze055qE6K6/6Zeu5Luk54mM5Ye95pWw55qE5Y+C5pWwXHJcbiAgICAgICAgICogQHBhcmFtIGNhbGxiYWNrIOWbnuiwg+WHveaVsO+8jOWcqOS4muWKoeaWueWujOaIkOS7pOeJjOiOt+WPluWQjuiwg+eUqOivpeWbnuiwg+WHveaVsOWwhuS7pOeJjOS/oeaBr+i/lOWbnue7meWqkuS9k+aJmOeuoeWuouaIt+err1xyXG4gICAgICAgICAqL1xyXG4gICAgICAgIChwYXJhbXM6IEdldE11bHRpU3BhY2VBY2Nlc3NUb2tlbkZ1bmNQYXJhbXMsIGNhbGxiYWNrOiBHZXRBY2Nlc3NUb2tlbkNhbGxiYWNrKTogdm9pZDtcclxuICAgIH1cclxuXHJcbiAgICAvKiog5a6e5L6L5YyW5aqS6LWE5omY566h5a6i5oi356uv55qE5Y+C5pWwICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIENvbnN0cnVjdG9yUGFyYW1zIHtcclxuICAgICAgICAvKiog5aqS5L2T5bqTIElEICovXHJcbiAgICAgICAgbGlicmFyeUlkOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtCBJRCAqL1xyXG4gICAgICAgIHNwYWNlSWQ/OiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOeUqOaItyBJRCAqL1xyXG4gICAgICAgIHVzZXJJZD86IHN0cmluZztcclxuXHJcbiAgICAgICAgLyoqIOiOt+WPluiuv+mXruS7pOeJjOWHveaVsO+8jOWqkui1hOaJmOeuoeWuouaIt+err+WwhuWcqOmcgOimgeiOt+WPluiuv+mXruS7pOeJjOaXtuiwg+eUqOivpeWHveaVsO+8jOS8oOWFpeebuOWFs+WPguaVsOWSjOWbnuiwg+WHveaVsO+8jOWcqOS4muWKoeaWueWujOaIkOS7pOeJjOiOt+WPluWQjuiwg+eUqOWbnuiwg+WHveaVsOi/lOWbnuS7pOeJjOS/oeaBr+OAgiAqL1xyXG4gICAgICAgIGdldEFjY2Vzc1Rva2VuOiBHZXRBY2Nlc3NUb2tlbkZ1bmM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOafpeivouWtl+espuS4sue7k+aehCAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBRdWVyeSB7XHJcbiAgICAgICAgW25hbWU6IHN0cmluZ106IHVuZGVmaW5lZCB8IHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4gfCAodW5kZWZpbmVkIHwgc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbilbXTtcclxuICAgIH1cclxuXHJcbiAgICAvKiog6K+35rGC5Y+C5pWwICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIFJlcXVlc3RQYXJhbXMge1xyXG4gICAgICAgIC8qKiDor7fmsYIgVVJMIOmZpOWOu+WJjee8gOeahOmDqOWIhiAqL1xyXG4gICAgICAgIHN1YlVybDogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDor7fmsYLmlrnms5UgKi9cclxuICAgICAgICBtZXRob2Q6ICdHRVQnIHwgJ0hFQUQnIHwgJ1BPU1QnIHwgJ1BVVCcgfCAnREVMRVRFJztcclxuICAgICAgICAvKiog6K+35rGC5p+l6K+i5a2X56ym5Liy57uT5p6EICovXHJcbiAgICAgICAgcXVlcnk/OiBRdWVyeTtcclxuICAgICAgICAvKiog6K+35rGC5L2T5pWw5o2uICovXHJcbiAgICAgICAgZGF0YT86IG9iamVjdDtcclxuICAgIH1cclxuXHJcbiAgICAvKiogXHJcbiAgICAgKiDlqpLotYTmiZjnrqHlkI7nq6/mnI3liqHplJnor69cclxuICAgICAqIEBwcml2YXRlXHJcbiAgICAgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgUmVtb3RlRXJyb3JEZXRhaWwge1xyXG4gICAgICAgIGNvZGU6IHN0cmluZztcclxuICAgICAgICBtZXNzYWdlOiBzdHJpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiDor7fmsYLmiJDlip/lkI7lkI7nq6/mnI3liqHov5Tlm57nmoTmlbDmja5cclxuICAgICAqIEB0eXBlcGFyYW0gVCDlkI7nq6/mnI3liqHov5Tlm57miJDlip/ml7bnmoTmlbDmja7nsbvlnotcclxuICAgICAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBSZXF1ZXN0UmVzdWx0PFQ+IHtcclxuICAgICAgICAvKiogSFRUUCDnirbmgIHnoIHvvIjlk43lupTnoIHvvIkgKi9cclxuICAgICAgICBzdGF0dXNDb2RlOiBudW1iZXI7XHJcbiAgICAgICAgLyoqIOWQjuerr+acjeWKoei/lOWbnueahOaVsOaNriAqL1xyXG4gICAgICAgIGRhdGE6IFQ7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWujOaIkOivt+axgueahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgUmVxdWVzdENhbGxiYWNrPFQgPSAnJz4gPSBHZW5lcmFsQ2FsbGJhY2s8UmVxdWVzdFJlc3VsdDxUPj47XHJcblxyXG4gICAgLyoqIOenn+aIt+epuumXtOaJqeWxlemAiemhuSAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBTcGFjZUV4dGVuc2lvbiB7XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtOaYr+WQpuWFgeiuuOWMv+WQjeivu+WPlu+8jOWNs+aXoOmcgOiuv+mXruS7pOeJjOWNs+WPr+ivu+WPluepuumXtOWGheWuueOAguivpeaJqeWxlemAiemhueWFgeiuuOmaj+WQjuS/ruaUueOAgiAqL1xyXG4gICAgICAgIGlzUHVibGljUmVhZD86IGJvb2xlYW47XHJcbiAgICAgICAgLyoqIOWqkuS9k+W6k+aYr+WQpuS4uuWkmuebuOewv+aooeW8j++8jOWmguaenOS4uuWkmuebuOewv+aooeW8j+WImeW/hemhu+WFiOWIm+W7uuebuOewv++8jOaJjeiDveWcqOebuOewv+S4reS4iuS8oOWqkuS9k+i1hOa6kO+8jOWQpuWImeS4jeWFgeiuuOWIm+W7uuebuOewv++8jOWPquiDveWcqOenn+aIt+epuumXtOagueebruW9leS4reS4iuS8oOWqkuS9k+i1hOa6kOOAguivpeaJqeWxlemAiemhueS4jeWFgeiuuOmaj+WQjuS/ruaUue+8jOS7heaUr+aMgeWcqOWIm+W7uuenn+aIt+epuumXtOaXtuaMh+WumuOAgiAqL1xyXG4gICAgICAgIGlzTXVsdGlBbGJ1bT86IGJvb2xlYW47XHJcbiAgICAgICAgLyoqIOenn+aIt+epuumXtOaYr+WQpuWFgeiuuOS4iuS8oOWbvueJhyAqL1xyXG4gICAgICAgIGFsbG93UGhvdG8/OiBib29sZWFuO1xyXG4gICAgICAgIC8qKiDnp5/miLfnqbrpl7TmmK/lkKblhYHorrjkuIrkvKDop4bpopEgKi9cclxuICAgICAgICBhbGxvd1ZpZGVvPzogYm9vbGVhbjtcclxuICAgICAgICAvKiog5paH5Lu25bqT5YWB6K645LiK5Lyg55qE5omp5bGV5ZCN77yM5aaCIC56aXAsIC5kb2N4IOetie+8jOWmguaenOS4jeaMh+WumuaIluaMh+WumuS4uuepuuaVsOe7hOWImeWFgeiuuOS4iuS8oOaJgOacieaJqeWxleWQjeeahOaWh+S7tuOAgiAqL1xyXG4gICAgICAgIGFsbG93RmlsZUV4dG5hbWU/OiBzdHJpbmdbXTtcclxuICAgICAgICAvKiog5aqS5L2T5bqT6K6k5a6a5Li65Zu+54mH55qE5omp5bGV5ZCN77yM5aaCIC5qcGcsIC5wbmcg562J77yM5aaC5p6c5LiN5oyH5a6a5oiW5oyH5a6a5Li656m65pWw57uE5YiZ5qC55o2u5omp5bGV5ZCN6Ieq5Yqo5Yik5pat5piv5ZCm5Li65bi46KeB5Zu+54mH57G75Z6L44CCICovXHJcbiAgICAgICAgYWxsb3dQaG90b0V4dG5hbWU/OiBzdHJpbmdbXTtcclxuICAgICAgICAvKiog5aqS5L2T5bqT6K6k5a6a5Li66KeG6aKR55qE5omp5bGV5ZCN77yM5aaCIC5tcDQsIC5tb3Yg562J77yM5aaC5p6c5LiN5oyH5a6a5oiW5oyH5a6a5Li656m65pWw57uE5YiZ5qC55o2u5omp5bGV5ZCN6Ieq5Yqo5Yik5pat5piv5ZCm5Li65bi46KeB6KeG6aKR57G75Z6L44CCICovXHJcbiAgICAgICAgYWxsb3dWaWRlb0V4dG5hbWU/OiBzdHJpbmdbXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIOWFgeiuuOmaj+WQjuS/ruaUueeahOaJqeWxlemAiemhueWQje+8jOW6k+exu+Wei+OAgeaYr+WQpuWkmuenn+aIt+WSjOaYr+WQpuWkmuebuOewv+S4jeWFgeiuuOS/ruaUueOAglxyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgZXhwb3J0IHR5cGUgQWxsb3dNb2RpZmllZEV4dGVuc2lvbkZpZWxkcyA9ICdpc1B1YmxpY1JlYWQnIHwgJ2FsbG93UGhvdG8nIHwgJ2FsbG93VmlkZW8nIHwgJ2FsbG93RmlsZUV4dG5hbWUnIHwgJ2FsbG93UGhvdG9FeHRuYW1lJyB8ICdhbGxvd1ZpZGVvRXh0bmFtZSdcclxuXHJcbiAgICAvKiog5YWB6K646ZqP5ZCO5L+u5pS555qE56ef5oi356m66Ze05omp5bGV6YCJ6aG5ICovXHJcbiAgICBleHBvcnQgdHlwZSBBbGxvd01vZGlmaWVkU3BhY2VFeHRlbnNpb24gPSBQaWNrPFNwYWNlRXh0ZW5zaW9uLCBBbGxvd01vZGlmaWVkRXh0ZW5zaW9uRmllbGRzPjtcclxuXHJcbiAgICAvKiog5oiQ5Yqf5Yib5bu655qE56ef5oi356m66Ze055qE55u45YWz5L+h5oGvICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIENyZWF0ZVNwYWNlUmVzdWx0IHtcclxuICAgICAgICAvKiog5oiQ5Yqf5Yib5bu655qE56ef5oi356m66Ze055qE56m66Ze0IElEICovXHJcbiAgICAgICAgc3BhY2VJZDogc3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDlrozmiJDliJvlu7rnp5/miLfnqbrpl7TnmoTlm57osIPlh73mlbAgKi9cclxuICAgIGV4cG9ydCB0eXBlIENyZWF0ZVNwYWNlQ2FsbGJhY2sgPSBSZXF1ZXN0Q2FsbGJhY2s8Q3JlYXRlU3BhY2VSZXN1bHQ+O1xyXG5cclxuICAgIC8qKiDliIbpobXliJflh7rnm67lvZXlj4LmlbAgKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgTGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uUGFyYW1zIHtcclxuICAgICAgICAvKiog55uu5b2V6Lev5b6EICovXHJcbiAgICAgICAgcGF0aDogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDliIbpobXmoIforrDvvIzlpoLkuI3mjIflrprliJnku47pppbmnaHlvIDlp4vov5Tlm57jgIIgKi9cclxuICAgICAgICBtYXJrZXI/OiBudW1iZXI7XHJcbiAgICAgICAgLyoqIOWNlemhteacgOWkmuadoeebruaVsO+8jOS4jeiDvei2hei/hyAxMDAw77yM5aaC5LiN5oyH5a6a6buY6K6k5Li6IDEwMDDjgIIgKi9cclxuICAgICAgICBsaW1pdD86IG51bWJlcjtcclxuICAgIH1cclxuXHJcbiAgICAvKiog55uu5b2V5YaF5a655p2h55uuICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIERpcmVjdG9yeUNvbnRlbnQge1xyXG4gICAgICAgIC8qKiDlrZDnm67lvZXmiJbmlofku7blkI0gKi9cclxuICAgICAgICBuYW1lOiBzdHJpbmc7XHJcbiAgICAgICAgLyoqIOadoeebruexu+WeiyAqL1xyXG4gICAgICAgIHR5cGU6ICdkaXInIHwgJ2ZpbGUnIHwgJ2ltYWdlJyB8ICd2aWRlbyc7XHJcbiAgICAgICAgLyoqIOWIm+W7uuaXtumXtCAqL1xyXG4gICAgICAgIGNyZWF0aW9uVGltZTogRGF0ZTtcclxuICAgIH1cclxuXHJcbiAgICAvKiog5oiQ5Yqf5YiX5Ye655qE5bim5YiG6aG155qE55uu5b2V5YaF5a655L+h5oGvICovXHJcbiAgICBleHBvcnQgaW50ZXJmYWNlIExpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvblJlc3VsdCB7XHJcbiAgICAgICAgLyoqIOW9k+WJjeWIl+WHuueahOebruW9leeahOi3r+W+hOe7k+aehCAqL1xyXG4gICAgICAgIHBhdGg6IHN0cmluZ1tdO1xyXG4gICAgICAgIC8qKiDliIbpobXmoIforrDvvIzlvZPov5Tlm57or6XlrZfmrrXml7bor7TmmI7liJflh7rnmoTmnaHnm67mnInmiKrmlq3vvIzpnIDnu6fnu63liJflh7rlkI7nu63liIbpobXjgIIgKi9cclxuICAgICAgICBuZXh0TWFya2VyPzogbnVtYmVyO1xyXG4gICAgICAgIC8qKiDnm67lvZXlhoXlrrnmnaHnm67liJfooaggKi9cclxuICAgICAgICBjb250ZW50czogRGlyZWN0b3J5Q29udGVudFtdO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDlrozmiJDliIbpobXliJflh7rmjIflrprnm67lvZXnmoTlm57osIPlh73mlbAgKi9cclxuICAgIGV4cG9ydCB0eXBlIExpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvbkNhbGxiYWNrID0gUmVxdWVzdENhbGxiYWNrPExpc3REaXJlY3RvcnlXaXRoUGFnaW5hdGlvblJlc3VsdD47XHJcblxyXG4gICAgLyoqIOaIkOWKn+WIl+WHuueahOebruW9leWGheWuueS/oeaBryAqL1xyXG4gICAgZXhwb3J0IHR5cGUgTGlzdERpcmVjdG9yeVJlc3VsdCA9IE9taXQ8TGlzdERpcmVjdG9yeVdpdGhQYWdpbmF0aW9uUmVzdWx0LCAnbmV4dE1hcmtlcic+O1xyXG5cclxuICAgIC8qKiDlrozmiJDliJflh7rnm67lvZXnmoTlm57osIPlh73mlbAgKi9cclxuICAgIGV4cG9ydCB0eXBlIExpc3REaXJlY3RvcnlDYWxsYmFjayA9IEdlbmVyYWxDYWxsYmFjazxMaXN0RGlyZWN0b3J5UmVzdWx0PjtcclxuXHJcbiAgICAvKiog5a6M5oiQ6I635Y+WIFVSTCDnmoTlm57osIPlh73mlbAgKi9cclxuICAgIGV4cG9ydCB0eXBlIEdldFVybENhbGxiYWNrID0gR2VuZXJhbENhbGxiYWNrPHN0cmluZ1tdPjtcclxuXHJcbiAgICAvKipcclxuICAgICAqIOS4iuS8oOWPguaVsOS/oeaBr1xyXG4gICAgICogQHByaXZhdGVcclxuICAgICAqL1xyXG4gICAgZXhwb3J0IGludGVyZmFjZSBCZWdpblVwbG9hZFJlc3VsdCB7XHJcbiAgICAgICAgLyoqIOS4iuS8oOebruagh+Wfn+WQjSAqL1xyXG4gICAgICAgIGRvbWFpbjogc3RyaW5nO1xyXG4gICAgICAgIC8qKiDkuIrkvKDooajljZXlrZfmrrUgKi9cclxuICAgICAgICBmb3JtOiBRdWVyeSxcclxuICAgICAgICAvKiog5LiK5Lyg56Gu6K6k5Y+C5pWwICovXHJcbiAgICAgICAgY29uZmlybUtleTogc3RyaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKiDmiJDlip/kuIrkvKDjgIHph43lkb3lkI3miJbnp7vliqjnmoTnm67moIfmlofku7bkv6Hmga8gKi9cclxuICAgIGV4cG9ydCBpbnRlcmZhY2UgVXBsb2FkUmVzdWx0IHtcclxuICAgICAgICAvKiog55uu5qCH5paH5Lu26Lev5b6E57uT5p6EICovXHJcbiAgICAgICAgcGF0aDogc3RyaW5nW107XHJcbiAgICB9XHJcblxyXG4gICAgLyoqIOWujOaIkOS4iuS8oOOAgemHjeWRveWQjeenu+WKqOeahOWbnuiwg+WHveaVsCAqL1xyXG4gICAgZXhwb3J0IHR5cGUgVXBsb2FkQ2FsbGJhY2sgPSBSZXF1ZXN0Q2FsbGJhY2s8VXBsb2FkUmVzdWx0PjtcclxufVxyXG5cclxuLyoqXHJcbiAqIOWqkui1hOaJmOeuoeWQjuerr+acjeWKoei/lOWbnueahOebruW9leWGheWuueadoeebrlxyXG4gKiBAcHJpdmF0ZVxyXG4gKi9cclxuaW50ZXJmYWNlIERpcmVjdG9yeUNvbnRlbnRJbm5lciBleHRlbmRzIE9taXQ8TUguRGlyZWN0b3J5Q29udGVudCwgJ2NyZWF0aW9uVGltZSc+IHtcclxuICAgIC8qKiDliJvlu7rml7bpl7QgKi9cclxuICAgIGNyZWF0aW9uVGltZTogc3RyaW5nO1xyXG59XHJcblxyXG4vKipcclxuICog5aqS6LWE5omY566h5ZCO56uv5pyN5Yqh6L+U5Zue55qE5bim5YiG6aG155qE55uu5b2V5YaF5a655L+h5oGvXHJcbiAqIEBwcml2YXRlXHJcbiAqL1xyXG5pbnRlcmZhY2UgTGlzdERpcmVjdG9yeVJlc3VsdElubmVyIGV4dGVuZHMgT21pdDxNSC5MaXN0RGlyZWN0b3J5V2l0aFBhZ2luYXRpb25SZXN1bHQsICdjb250ZW50cyc+IHtcclxuICAgIC8qKiDnm67lvZXlhoXlrrnmnaHnm67liJfooaggKi9cclxuICAgIGNvbnRlbnRzOiBEaXJlY3RvcnlDb250ZW50SW5uZXJbXTtcclxufVxyXG5cclxuZXhwb3J0IHsgTUggYXMgTWVkaWFIb3N0aW5nIH07XHJcbiJdfQ==