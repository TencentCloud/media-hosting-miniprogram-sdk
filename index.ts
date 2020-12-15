/** 媒资托管客户端小程序 SDK */

/**
 * 访问令牌最小有效时长，当访问令牌剩余有效时长低于该值时，将触发续期或刷新访问令牌。
 * @private
 */
const MIN_PERIOD_SECONDS = 300;
/**
 * 媒资托管后端服务 URL 前缀
 * @private
 */
const URL_PREFIX = 'https://smh.tencentcs.com/api/v1';

/**
 * 媒资托管客户端。该类和命名空间使用名字 MediaHosting 导出：
 * 
 * ```js
 * export { MH as MediaHosting };
 * ```
 */
class MH {

    private static multiSpaceAccessTokenMapping: {
        [key: string]: {
            [spaceId: string]: {
                /** 访问令牌 */
                token: MH.AccessToken;
                /** 访问令牌生成时间 */
                timestamp: number;
            };
        };
    } = {};
    static getMultiSpaceAccessToken: MH.GetMultiSpaceAccessTokenFunc;

    private _spaceId?: string;
    private _userId?: string;

    /** 获取当前指定的媒体库 ID */
    readonly libraryId: string;

    /** 获取当前指定的租户空间 ID */
    get spaceId() {
        return this._spaceId || '-';
    }
    /** 设置租户空间 ID */
    set spaceId(value: string) {
        if (this._spaceId !== value) {
            this.updateToken(null);
        }
        this._spaceId = value;
    }

    /** 获取当前指定的用户 ID */
    get userId() {
        return this._userId || '';
    }
    /** 设置用户 ID */
    set userId(value: string) {
        if (this._userId !== value) {
            this.updateToken(null);
        }
        this._userId = value;
    }

    private readonly getAccessToken: MH.GetAccessTokenFunc;

    private token?: MH.AccessToken;
    private tokenTimestamp: number = 0;
    private tokenTimer: number = 0;

    /**
     * 实例化媒资托管客户端
     * @param params 实例化参数
     */
    constructor(params: MH.ConstructorParams) {
        const { libraryId, spaceId, userId, getAccessToken } = params;
        this.libraryId = libraryId;
        this._spaceId = spaceId;
        this._userId = userId;

        this.getAccessToken = getAccessToken;
    }

    /**
     * 判断回调是否为错误回调，当发生错误时 result 为 undefined，否则 result 不为 undefined。
     * @param err 错误或 null
     * @param result 回调结果值
     * @returns 是否为错误回调，此时 result 为 undefined。
     */
    // @ts-ignore: error TS6133: 'result' is declared but its value is never read.
    private static hasError(err: Error | null, result: any): result is undefined {
        return !!err;
    }

    /**
     * 检查指定的访问令牌是否需要刷新
     * @param token 访问令牌
     * @param tokenTimestamp 访问令牌生成时间
     * @param forceRenew 是否强制续期
     */
    private static checkNeedRefreshToken(token: MH.AccessToken, tokenTimestamp: number, forceRenew?: boolean) {
        const sinceLastRefresh = Math.floor((Date.now() - tokenTimestamp) / 1000);
        if ((!forceRenew && token.expiresIn - sinceLastRefresh > MIN_PERIOD_SECONDS)
            || sinceLastRefresh < MIN_PERIOD_SECONDS) {
            // 不需要强制刷新且有效期超过5分钟，或者需要强制刷新但距离上次刷新不足5分钟，直接返回
            return false;
        }
        return true;
    }

    /**
     * 判断媒资托管后端服务返回的数据是否为后端错误
     * @param data 媒资托管后端服务返回的数据
     * @returns 是否为后端错误
     */
    private static isRemoteError(data: any): data is MH.RemoteErrorDetail {
        return typeof data === 'object' && typeof data.code === 'string' && typeof data.message === 'string';
    }

    /**
     * 字符串化查询字符串
     * @param query 查询字符串键值对
     * @returns 查询字符串
     */
    static stringifyQueryString(query: MH.Query) {
        const queryList = [];
        for (const name in query) {
            let value = query[name];
            if (!Array.isArray(value)) {
                value = [value];
            }
            for (const subValue of value) {
                if (subValue === void 0) {
                    continue;
                }
                if (subValue === '') {
                    queryList.push(encodeURIComponent(name));
                } else {
                    queryList.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(subValue))}`);
                }
            }
        }
        const queryString = queryList.length ? queryList.join('&') : '';
        return queryString;
    }

    /**
     * 编码路径
     * @param path 原始路径
     * @returns 编码后可直接拼接在 URL 中的路径
     */
    static encodePath(path: string) {
        return path.split('/').filter(name => name).map(name => encodeURIComponent(name)).join('/');
    }

    /**
     * 确保可用于多个指定租户空间的访问令牌存在且在有效期内，否则将自动更新访问令牌。
     * @param libraryId 媒体库 ID
     * @param spaceIdList 租户空间 ID 列表
     * @param callback 回调函数，返回是否成功及成功后符合要求有效期的可用于多个指定租户空间的访问令牌。
     */
    static ensureMultiSpaceToken(libraryId: string, spaceIdList: string[], callback?: MH.GetMultiSpaceAccessTokenCallback): void;
    /**
     * 确保可用于多个指定租户空间的访问令牌存在且在有效期内，否则将自动更新访问令牌。
     * @param libraryId 媒体库 ID
     * @param spaceIdList 租户空间 ID 列表
     * @param userId 用户 ID
     * @param callback 回调函数，返回是否成功及成功后符合要求有效期的可用于多个指定租户空间的访问令牌。
     */
    static ensureMultiSpaceToken(libraryId: string, spaceIdList: string[], userId: string, callback?: MH.GetMultiSpaceAccessTokenCallback): void;
    static ensureMultiSpaceToken(libraryId: string, spaceIdList: string[], userId?: string | MH.GetMultiSpaceAccessTokenCallback, callback?: MH.GetMultiSpaceAccessTokenCallback) {
        if (typeof userId === 'function') {
            callback = userId;
            userId = void 0;
        }
        userId = userId || '';
        const key = [libraryId, userId].join('$');
        if (!(key in MH.multiSpaceAccessTokenMapping)) {
            MH.multiSpaceAccessTokenMapping[key] = {};
        }
        const mapping = MH.multiSpaceAccessTokenMapping[key];
        const pendingSpaceIdList: string[] = [];
        const result: MH.MultiSpaceAccessToken = {};
        for (const spaceId of spaceIdList) {
            const accessToken = mapping[spaceId];
            if (accessToken && !MH.checkNeedRefreshToken(accessToken.token, accessToken.timestamp, true)) {
                result[spaceId] = accessToken.token;
            } else {
                pendingSpaceIdList.push(spaceId);
            }
        }
        if (!pendingSpaceIdList.length) {
            return callback?.(null, result);
        }
        if (typeof MH.getMultiSpaceAccessToken !== 'function') {
            return callback?.(new MH.ParamError('Invalid getMultiSpaceAccessToken'));
        }
        MH.getMultiSpaceAccessToken({ libraryId, spaceIdList: pendingSpaceIdList, userId }, (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(new MH.GetAccessTokenError(err));
            }
            const timestamp = Date.now();
            const spaceIdToken = { token, timestamp };
            for (const spaceId of pendingSpaceIdList) {
                mapping[spaceId] = spaceIdToken;
                result[spaceId] = token;
            }
            callback?.(null, result);
        });
    }

    /**
     * 批量获取媒体库指定租户空间的封面图片 URL
     * @param libraryId 媒体库 ID。
     * @param spaceIdList 租户空间 ID 列表。
     * @param size 封面图片大小(px)，将缩放裁剪为正方形图片，如不指定则为原始大小。
     * @param callback 回调函数，返回是否成功及成功获取的相簿封面图片 URL。
     * @return 与指定的租户空间 ID 列表顺序对应的租户空间封面图片 URL 列表。
     */
    static getSpaceCoverUrl(libraryId: string, spaceIdList: string[], size?: number, callback?: MH.GetUrlCallback) {
        MH.ensureMultiSpaceToken(libraryId, spaceIdList, (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(err);
            }
            const urls = spaceIdList.map(spaceId => `${URL_PREFIX}/album/${libraryId}/${spaceId}/cover?${MH.stringifyQueryString({
                access_token: token[spaceId].accessToken,
                size,
            })}`);
            callback?.(null, urls);
        });
    }

    private updateToken(token?: MH.AccessToken | null, callback?: MH.GetAccessTokenCallback) {
        if (token && (
            typeof token.accessToken !== 'string' || !token.accessToken ||
            typeof token.expiresIn !== 'number' || token.expiresIn <= 0
        )) {
            return callback?.(new MH.BaseError('Invalid token'));
        }
        if (token) {
            this.token = token;
        } else if (token === null) {
            // force empty token
            this.token = void 0;
        }
        this.tokenTimestamp = Date.now();
        if (this.tokenTimer) {
            clearTimeout(this.tokenTimer);
        }
        if (this.token) {
            this.tokenTimer = setTimeout(() => this.ensureToken(), (this.token.expiresIn - MIN_PERIOD_SECONDS) * 1000);
            callback?.(null, this.token);
        }
    }

    /**
     * 刷新访问令牌
     * @param callback 访问令牌刷新完成回调，返回是否成功及成功后最新的访问令牌信息。
     */
    refreshToken(callback?: MH.GetAccessTokenCallback) {
        this.getAccessToken({
            libraryId: this.libraryId,
            spaceId: this.spaceId,
            userId: this.userId,
        }, (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(new MH.GetAccessTokenError(err));
            }
            this.updateToken(token, callback);
        });
    }

    /**
     * 确保访问令牌存在且在有效期内，否则将自动续期或刷新访问令牌。
     * @param callback 回调函数，返回是否成功及成功后在有效期内的访问令牌。
     */
    ensureToken(callback?: MH.GetAccessTokenCallback): void;
    /**
     * 确保访问令牌存在且在有效期内，否则将自动续期或刷新访问令牌。
     * @param forceRenew 是否强制续期，指定为 true 时，如果访问令牌距离上次使用已经超过 5 分钟，将自动续期；如果访问令牌剩余有效期不足 5 分钟，则忽略该参数强制自动续期。
     * @param callback 回调函数，返回是否成功及成功后符合要求有效期的访问令牌。
     */
    ensureToken(forceRenew?: boolean, callback?: MH.GetAccessTokenCallback): void;
    ensureToken(forceRenew?: boolean | MH.GetAccessTokenCallback, callback?: MH.GetAccessTokenCallback) {
        if (typeof forceRenew === 'function') {
            callback = forceRenew;
            forceRenew = void 0;
        }
        if (!this.token) {
            return this.refreshToken(callback);
        }
        const token = this.token!;
        if (!MH.checkNeedRefreshToken(token, this.tokenTimestamp, forceRenew)) {
            return callback?.(null, token);
        }
        wx.request({
            url: `${URL_PREFIX}/token/${this.libraryId}/${token.accessToken}`,
            method: 'POST',
            success: (result) => {
                const { data } = result;
                if (MH.isRemoteError(data)) {
                    if (data.code === 'InvalidAccessToken') {
                        // 无效，直接刷新
                        return this.refreshToken(callback);
                    }
                    // 其他错误，抛出去
                    return callback?.(new MH.RemoteError(result.statusCode, data.code, data.message));
                }
                const token = data as MH.AccessToken;
                this.updateToken(token, callback);
            },
            fail: (res) => {
                // 请求错误，抛出去
                callback?.(new MH.WxRequestError(res.errMsg));
            },
        });
    }

    /**
     * 向媒资托管后端服务发起请求
     * @typeparam T 后端服务返回成功时的数据类型
     * @param params 请求参数
     * @param callback 请求完成回调函数，返回是否成功及成功后后端服务返回的数据。
     */
    private request<T = ''>(params: MH.RequestParams, callback?: MH.RequestCallback<T>) {
        const { subUrl, method, query = {}, data = {} } = params;
        const innerCallback: MH.GetAccessTokenCallback = (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(err);
            }
            query.access_token = token.accessToken;
            wx.request({
                url: `${URL_PREFIX}${subUrl}${subUrl.includes('?') ? '&' : '?'}${MH.stringifyQueryString(query)}`,
                method,
                data,
                success: (result) => {
                    const data = result.data as T;
                    // 如果返回204那么data是空字符串
                    if (MH.isRemoteError(data)) {
                        if (data.code === 'InvalidAccessToken') {
                            this.updateToken(null);
                            return this.ensureToken(innerCallback);
                        }
                        return callback?.(new MH.RemoteError(result.statusCode, data.code, data.message));
                    }
                    this.updateToken();
                    callback?.(null, {
                        statusCode: result.statusCode,
                        data,
                    });
                },
                fail: (res) => {
                    callback?.(new MH.WxRequestError(res.errMsg));
                },
            });
        };
        this.ensureToken(innerCallback);
    }

    /**
     * 创建租户空间。在创建成功后，当前实例的租户空间 ID 将自动指向新创建的租户空间。
     * @param callback 创建完成回调函数，返回是否成功及成功创建的租户空间的相关信息。
     */
    createSpace(callback?: MH.CreateSpaceCallback): void
    /**
     * 创建具有指定扩展选项的租户空间。在创建成功后，当前实例的租户空间 ID 将自动指向新创建的租户空间。
     * @param extension 租户空间扩展选项
     * @param callback 创建完成回调函数，返回是否成功及成功创建的租户空间的相关信息。
     */
    createSpace(extension?: MH.SpaceExtension, callback?: MH.CreateSpaceCallback): void
    createSpace(extension?: MH.SpaceExtension | MH.CreateSpaceCallback, callback?: MH.CreateSpaceCallback) {
        const params: MH.RequestParams = {
            subUrl: `/space/${this.libraryId}`,
            method: 'POST',
        };
        if (typeof extension === 'function') {
            callback = extension;
            extension = void 0;
        }
        if (extension) {
            params.data = extension;
        }
        this.request<MH.CreateSpaceResult>(params, (err, result) => {
            if (MH.hasError(err, result)) {
                return callback?.(err);
            }
            this.spaceId = result.data.spaceId;
            callback?.(null, result);
        });
    }

    /**
    * 修改租户空间的部分扩展选项
    * @param extension 需要修改的扩展选项，只有部分选项支持修改且仅在该参数中出现的选项会被修改。
    * @param callback 修改完成回调函数，返回是否成功。
    */
    updateSpaceExtension(extension: MH.AllowModifiedSpaceExtension, callback?: MH.RequestCallback) {
        this.request({
            subUrl: `/space/${this.libraryId}/${this.spaceId}/extension`,
            method: 'POST',
            data: extension,
        }, callback);
    }

    /**
     * 删除租户空间。在删除成功后，当前实例的租户空间 ID 将自动置空，需要重新创建新的租户空间或手动指向其他的租户空间。
     * @param callback 删除完成回调函数，返回是否成功。
     */
    deleteSpace(callback?: MH.RequestCallback) {
        this.request({
            subUrl: `/space/${this.libraryId}/${this.spaceId}`,
            method: 'DELETE',
        }, (err, result) => {
            if (MH.hasError(err, result)) {
                return callback?.(err);
            }
            this.spaceId = '';
            callback?.(null, result);
        });
    }

    /**
     * 分页列出指定目录中的内容
     * @param params 分页列出目录参数
     * @param callback 回调函数，返回是否成功及成功列出的目录内容信息。
     */
    listDirectoryWithPagination(params: MH.ListDirectoryWithPaginationParams, callback?: MH.ListDirectoryWithPaginationCallback) {
        const { path, marker, limit } = params;
        this.request<ListDirectoryResultInner>({
            subUrl: `/directory/${this.libraryId}/${this.spaceId}/${path ? MH.encodePath(path) : ''}`,
            method: 'GET',
            query: { marker, limit },
        }, (err, result) => {
            if (MH.hasError(err, result)) {
                return callback?.(err);
            }
            if (result) {
                const contents: MH.DirectoryContent[] = [];
                for (const item of result.data.contents) {
                    contents.push({
                        name: item.name,
                        type: item.type,
                        creationTime: new Date(item.creationTime),
                    });
                }
                callback?.(null, {
                    statusCode: result.statusCode,
                    data: {
                        path: result.data.path,
                        nextMarker: result.data.nextMarker,
                        contents,
                    },
                });
            }
        });
    }

    /**
     * 列出根目录中的内容，该方法将自动从第 1 页开始列出根目录直到所有页均列出。
     * @param callback 回调函数，返回是否成功及成功列出的目录内容信息。
     */
    listDirectory(callback?: MH.ListDirectoryCallback): void;
    /**
     * 列出指定目录中的内容，该方法将自动从第 1 页开始列出指定目录直到所有页均列出。
     * @param path 目录路径
     * @param callback 回调函数，返回是否成功及成功列出的目录内容信息。
     */
    listDirectory(path: string, callback?: MH.ListDirectoryCallback): void;
    listDirectory(path?: string | MH.ListDirectoryCallback, callback?: MH.ListDirectoryCallback) {
        if (typeof path === 'function') {
            callback = path;
            path = void 0;
        }
        const innerPath = path || '';
        let returnPath: string[] = [];
        let contents: MH.DirectoryContent[] = [];
        let marker: number | undefined = void 0;
        let retriedTimes = 0;
        let innerCallback: MH.ListDirectoryWithPaginationCallback = (err, result) => {
            if (MH.hasError(err, result)) {
                if (retriedTimes >= 2 || (err instanceof MH.GetAccessTokenError) ||
                    (err instanceof MH.RemoteError) && (err.status === 403 || err.status === 404)) {
                    return callback?.(err);
                }
                retriedTimes++;
            } else if (result) {
                retriedTimes = 0;
                returnPath = result.data.path;
                contents = contents.concat(result.data.contents);
                if (result.data.nextMarker) {
                    marker = result.data.nextMarker;
                } else {
                    return callback?.(null, { path: returnPath, contents });
                }
            }
            this.listDirectoryWithPagination({ path: innerPath, marker }, innerCallback);
        };
        innerCallback(null);
    }

    /**
     * 创建目录
     * @param path 目录路径
     * @param callback 创建完成回调函数，返回是否成功。
     */
    createDirectory(path: string, callback?: MH.RequestCallback) {
        if (!path) {
            return callback?.(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: `/directory/${this.libraryId}/${this.spaceId}/${MH.encodePath(path)}`,
            method: 'PUT',
        }, callback);
    }

    /**
     * 删除指定目录
     * @param path 目录路径
     * @param callback 删除完成回调函数，返回是否成功。
     */
    deleteDirectory(path: string, callback?: MH.RequestCallback) {
        if (!path) {
            return callback?.(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: `/directory/${this.libraryId}/${this.spaceId}/${MH.encodePath(path)}`,
            method: 'DELETE',
        }, callback);
    }

    /**
     * 重命名或移动指定目录
     * @param fromPath 源目录完整路径
     * @param toPath 目标目录完整路径
     * @param callback 重命名或移动完成回调函数，返回是否成功。
     */
    moveDirectory(fromPath: string, toPath: string, callback?: MH.RequestCallback) {
        if (!fromPath) {
            return callback?.(new MH.ParamError('Param fromPath is empty.'));
        }
        if (!toPath) {
            return callback?.(new MH.ParamError('Param toPath is empty.'));
        }
        this.request({
            subUrl: `/directory/${this.libraryId}/${this.spaceId}/${MH.encodePath(toPath)}`,
            method: 'PUT',
            data: {
                from: fromPath
            },
        }, callback);
    }

    /**
     * 获取媒体库指定相簿的封面图片 URL
     * @param albumName 相簿名，对于非多相簿模式可指定空字符串获取整个空间的封面图。
     * @param callback 回调函数，返回是否成功及成功获取的相簿封面图片 URL。
     */
    getCoverUrl(albumName: string, callback?: MH.GetUrlCallback): void;
    /**
     * 获取媒体库指定相簿的指定大小的封面图片 URL
     * @param albumName 相簿名，对于非多相簿模式可指定空字符串获取整个空间的封面图。
     * @param size 封面图片大小(px)，将缩放裁剪为正方形图片。
     * @param callback 回调函数，返回是否成功及成功获取的相簿封面图片 URL。
     */
    getCoverUrl(albumName: string, size: number, callback?: MH.GetUrlCallback): void;
    /**
     * 批量获取媒体库指定相簿的封面图片 URL
     * @param albumNameList 相簿名列表，对于非多相簿模式可指定空字符串获取整个空间的封面图。
     * @param callback 回调函数，返回是否成功及成功获取的相簿封面图片 URL。
     */
    getCoverUrl(albumNameList: string[], callback?: MH.GetUrlCallback): void;
    /**
     * 批量获取媒体库指定相簿的指定大小的封面图片 URL
     * @param albumNameList 相簿名列表，对于非多相簿模式可指定空字符串获取整个空间的封面图。
     * @param size 封面图片大小(px)，将缩放裁剪为正方形图片。
     * @param callback 回调函数，返回是否成功及成功获取的相簿封面图片 URL。
     */
    getCoverUrl(albumNameList: string[], size: number, callback?: MH.GetUrlCallback): void;
    getCoverUrl(albumNameList: string | string[], size?: number | MH.GetUrlCallback, callback?: MH.GetUrlCallback) {
        this.ensureToken(true, (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(err);
            }
            if (!Array.isArray(albumNameList)) {
                albumNameList = [albumNameList];
            }
            if (typeof size === 'function') {
                callback = size;
                size = void 0;
            }
            const query: MH.Query = {
                access_token: token.accessToken,
                size,
            };
            const urls = albumNameList.map(albumName => `${URL_PREFIX}/album/${this.libraryId}/${this.spaceId}/cover${albumName ? '/' + MH.encodePath(albumName) : ''}?${MH.stringifyQueryString(query)}`);
            callback?.(null, urls);
        });
    }

    private getFileUrlWithQuery(pathList: string | string[], query: MH.Query, callback?: MH.GetUrlCallback) {
        if (typeof pathList === 'string' && !pathList || Array.isArray(pathList) && !pathList.length) {
            return callback?.(new MH.ParamError('Param path/pathList is empty.'));
        }
        this.ensureToken(true, (err, token) => {
            if (MH.hasError(err, token)) {
                return callback?.(err);
            }
            if (!Array.isArray(pathList)) {
                pathList = [pathList];
            }
            const urls = pathList.map(path => `${URL_PREFIX}/file/${this.libraryId}/${this.spaceId}/${MH.encodePath(path)}?${MH.stringifyQueryString({
                ...query,
                access_token: token.accessToken,
            })}`);
            callback?.(null, urls);
        });
    }

    /**
     * 获取指定文件 URL
     * @param path 文件路径
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getFileUrl(path: string, callback?: MH.GetUrlCallback): void;
    /**
     * 批量获取指定文件 URL
     * @param pathList 文件路径列表
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getFileUrl(pathList: string[], callback?: MH.GetUrlCallback): void;
    getFileUrl(pathList: string | string[], callback?: MH.GetUrlCallback) {
        this.getFileUrlWithQuery(pathList, {}, callback);
    }

    /**
     * 获取指定照片 URL 或视频的封面 URL
     * @param path 文件路径
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getPreviewUrl(path: string, callback?: MH.GetUrlCallback): void;
    /**
     * 获取指定媒体文件的指定大小的缩略图 URL
     * @param path 文件路径
     * @param size 缩略图大小(px)，将缩放裁剪为正方形图片。
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getPreviewUrl(path: string, size: number, callback?: MH.GetUrlCallback): void;
    /**
     * 批量获取指定照片 URL 或视频的封面 URL
     * @param pathList 文件路径列表
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getPreviewUrl(pathList: string[], callback?: MH.GetUrlCallback): void;
    /**
     * 批量获取指定媒体文件的指定大小的缩略图 URL
     * @param pathList 文件路径列表
     * @param size 缩略图大小(px)，将缩放裁剪为正方形图片。
     * @param callback 回调函数，返回是否成功及成功获取的文件 URL。
     */
    getPreviewUrl(pathList: string[], size: number, callback?: MH.GetUrlCallback): void;
    getPreviewUrl(pathList: string | string[], size?: number | MH.GetUrlCallback, callback?: MH.GetUrlCallback) {
        if (typeof size === 'function') {
            callback = size;
            size = void 0;
        }
        this.getFileUrlWithQuery(pathList, {
            preview: '',
            size,
        }, callback);
    }

    /**
     * 上传文件
     * @param remotePath 文件的远程目标路径，如果指定路径存在同名文件或目录则自动改名。
     * @param localPath 在微信内获取的文件本地路径
     * @param callback 上传完成回调函数，返回是否成功及成功上传的文件的信息。
     */
    uploadFile(remotePath: string, localPath: string, callback?: MH.UploadCallback): void;
    /**
     * 上传文件并可指定遇到同名文件或目录时的处理方法
     * @param remotePath 文件的远程目标路径
     * @param localPath 在微信内获取的文件本地路径
     * @param force 是否强制覆盖同名文件或目录，当选择强制覆盖时，同名文件将会被删除，同名目录将会连同目录内容一并被删除。
     * @param callback 上传完成回调函数，返回是否成功及成功上传的文件的信息。
     */
    uploadFile(remotePath: string, localPath: string, force: boolean, callback?: MH.UploadCallback): void;
    uploadFile(remotePath: string, localPath: string, force?: boolean | MH.UploadCallback, callback?: MH.UploadCallback) {
        if (!remotePath) {
            return callback?.(new MH.ParamError('Param remotePath is empty.'));
        }
        if (!localPath) {
            return callback?.(new MH.ParamError('Param localPath is empty.'));
        }
        if (typeof force === 'function') {
            callback = force;
            force = void 0;
        }
        this.request<MH.BeginUploadResult>({
            subUrl: `/file/${this.libraryId}/${this.spaceId}/${MH.encodePath(remotePath)}`,
            method: 'POST',
            query: {
                force: force ? 1 : 0,
            },
        }, (err, result) => {
            if (MH.hasError(err, result)) {
                return callback?.(err);
            }
            const { data } = result;
            const { domain, form, confirmKey } = data;
            wx.uploadFile({
                url: `https://${domain}/`,
                filePath: localPath,
                name: 'file',
                formData: form,
                success: (result) => {
                    if (result.statusCode !== 204) {
                        return callback?.(new MH.CosError(result.data));
                    }
                    this.request({
                        subUrl: `/file/${this.libraryId}/${this.spaceId}/${confirmKey}?confirm`,
                        method: 'POST',
                    }, callback);
                },
                fail: (res) => {
                    callback?.(new MH.WxRequestError(res.errMsg));
                },
            })
        });
    }

    /**
     * 删除指定文件
     * @param path 文件路径
     * @param callback 删除完成回调函数，返回是否成功。
     */
    deleteFile(path: string, callback?: MH.RequestCallback) {
        if (!path) {
            return callback?.(new MH.ParamError('Param path is empty.'));
        }
        this.request({
            subUrl: `/file/${this.libraryId}/${this.spaceId}/${MH.encodePath(path)}`,
            method: 'DELETE',
        }, callback);
    }

    /**
     * 重命名或移动指定文件
     * @param fromPath 源文件完整路径
     * @param toPath 目标文件完整路径，如果指定路径存在同名文件或目录则自动改名。
     * @param callback 重命名或移动完成回调函数，返回是否成功及成功重命名或移动的目标文件信息。
     */
    moveFile(fromPath: string, toPath: string, callback?: MH.UploadCallback): void;
    /**
     * 重命名或移动指定文件并可指定遇到同名文件或目录时的处理方法
     * @param fromPath 源文件完整路径
     * @param toPath 目标文件完整路径
     * @param force 是否强制覆盖同名文件或目录，当选择强制覆盖时，同名文件将会被删除，同名目录将会连同目录内容一并被删除。
     * @param callback 重命名或移动完成回调函数，返回是否成功及成功重命名或移动的目标文件信息。
     */
    moveFile(fromPath: string, toPath: string, force: boolean, callback?: MH.UploadCallback): void;
    moveFile(fromPath: string, toPath: string, force?: boolean | MH.UploadCallback, callback?: MH.UploadCallback) {
        if (!fromPath) {
            return callback?.(new MH.ParamError('Param fromPath is empty.'));
        }
        if (!toPath) {
            return callback?.(new MH.ParamError('Param toPath is empty.'));
        }
        if (typeof force === 'function') {
            callback = force;
            force = void 0;
        }
        this.request({
            subUrl: `/file/${this.libraryId}/${this.spaceId}/${MH.encodePath(toPath)}`,
            method: 'PUT',
            query: {
                force: force ? 1 : 0,
            },
            data: {
                from: fromPath
            },
        }, callback);
    }
}

namespace MH {

    /** 在 ES5 下修复了原型链的错误基类 */
    export class BaseError extends Error {
        constructor(message: string) {
            super(message);
            this.name = new.target.name;
            const { captureStackTrace } = Error as any;
            if (typeof captureStackTrace === 'function') {
                captureStackTrace(this, new.target);
            }
            if (typeof Object.setPrototypeOf === 'function') {
                Object.setPrototypeOf(this, new.target.prototype);
            } else {
                (this as any).__proto__ = new.target.prototype;
            }
        }
    }

    /**参数错误 */
    export class ParamError extends BaseError { }

    /** 通过微信接口发起请求时发生错误 */
    export class WxRequestError extends BaseError { }

    /** 获取访问令牌时业务侧发生错误 */
    export class GetAccessTokenError extends BaseError {

        /** 获取访问令牌时业务侧返回的错误 */
        public readonly nestedError: Error | null;

        constructor(nestedError: Error | null) {
            super(nestedError?.message || 'An error occured while getting access token');
            this.nestedError = nestedError;
            if (nestedError) {
                this.stack = nestedError.stack;
            }
        }
    }

    /** 媒资托管后端服务错误 */
    export class RemoteError extends BaseError {

        /** HTTP 状态码 */
        public readonly status: number;

        /** 错误码 */
        public readonly code: string;

        /** 
         * 实例化媒资托管后端服务错误
         * @param status HTTP 状态码
         * @param code 错误码
         * @param message 错误信息
         * @private
         */
        constructor(status: number, code: string, message: string) {
            super(message);
            this.status = status;
            this.code = code;
        }
    }

    /** 对象存储后端服务错误 */
    export class CosError extends BaseError {

        /** 错误码 */
        public readonly code: string;
        /** 请求 ID */
        public readonly requestId: string;

        /** 
         * 实例化对象存储后端服务错误
         * @param errorXml 对象存储后端服务返回的包含错误信息的 XML 字符串
         * @private
         */
        constructor(errorXml: string = '') {
            const code = /<Code>([^<]+)<\/Code>/i.exec(errorXml)?.[1] || '';
            const message = /<Message>([^<]+)<\/Message>/i.exec(errorXml)?.[1] || '';
            const requestId = /<RequestId>([^<]+)<\/RequestId>/i.exec(errorXml)?.[1] || '';
            super(message);
            this.code = code;
            this.requestId = requestId;
        }
    }

    /**
     * 通用回调方法
     * @typeparam T 成功回调时的回调值的类型
     */
    export interface GeneralCallback<T> {
        /**
         * @param err 错误或 null，当为 null 时代表成功回调。
         * @param result 成功回调时的回调值
         */
        (err: Error | null, result?: T): void;
    }

    /** 访问令牌信息 */
    export interface AccessToken {
        /** 访问令牌 */
        accessToken: string;
        /** 有效时长（单位：秒） */
        expiresIn: number;
    }

    /** 可用于多个指定租户空间的访问令牌信息 */
    export interface MultiSpaceAccessToken {
        [spaceId: string]: AccessToken;
    }

    /** 完成获取访问令牌函数的回调函数 */
    export type GetAccessTokenCallback = GeneralCallback<AccessToken>;

    /** 完成获取可用于多个指定租户空间的访问令牌函数的回调函数 */
    export type GetMultiSpaceAccessTokenCallback = GeneralCallback<MultiSpaceAccessToken>;

    /** 获取访问令牌函数的参数 */
    export interface GetAccessTokenFuncParams {
        /** 媒体库 ID */
        libraryId: string;
        /** 租户空间 ID */
        spaceId: string;
        /** 用户 ID */
        userId: string;
    }

    /** 获取可用于多个指定租户空间的访问令牌函数的参数 */
    export interface GetMultiSpaceAccessTokenFuncParams {
        /** 媒体库 ID */
        libraryId: string;
        /** 租户空间 ID 列表 */
        spaceIdList: string[];
        /** 用户 ID */
        userId: string;
    }

    /** 获取访问令牌函数 */
    export interface GetAccessTokenFunc {
        /**
         * @param params 获取访问令牌函数的参数
         * @param callback 回调函数，在业务方完成令牌获取后调用该回调函数将令牌信息返回给媒体托管客户端
         */
        (params: GetAccessTokenFuncParams, callback: GetAccessTokenCallback): void;
    }

    /** 获取可用于多个指定租户空间的访问令牌函数 */
    export interface GetMultiSpaceAccessTokenFunc {
        /**
         * @param params 获取可用于多个指定租户空间的访问令牌函数的参数
         * @param callback 回调函数，在业务方完成令牌获取后调用该回调函数将令牌信息返回给媒体托管客户端
         */
        (params: GetMultiSpaceAccessTokenFuncParams, callback: GetAccessTokenCallback): void;
    }

    /** 实例化媒资托管客户端的参数 */
    export interface ConstructorParams {
        /** 媒体库 ID */
        libraryId: string;
        /** 租户空间 ID */
        spaceId?: string;
        /** 用户 ID */
        userId?: string;

        /** 获取访问令牌函数，媒资托管客户端将在需要获取访问令牌时调用该函数，传入相关参数和回调函数，在业务方完成令牌获取后调用回调函数返回令牌信息。 */
        getAccessToken: GetAccessTokenFunc;
    }

    /** 查询字符串结构 */
    export interface Query {
        [name: string]: undefined | string | number | boolean | (undefined | string | number | boolean)[];
    }

    /** 请求参数 */
    export interface RequestParams {
        /** 请求 URL 除去前缀的部分 */
        subUrl: string;
        /** 请求方法 */
        method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';
        /** 请求查询字符串结构 */
        query?: Query;
        /** 请求体数据 */
        data?: object;
    }

    /** 
     * 媒资托管后端服务错误
     * @private
     */
    export interface RemoteErrorDetail {
        code: string;
        message: string;
    }

    /**
     * 请求成功后后端服务返回的数据
     * @typeparam T 后端服务返回成功时的数据类型
     */
    export interface RequestResult<T> {
        /** HTTP 状态码（响应码） */
        statusCode: number;
        /** 后端服务返回的数据 */
        data: T;
    }

    /** 完成请求的回调函数 */
    export type RequestCallback<T = ''> = GeneralCallback<RequestResult<T>>;

    /** 租户空间扩展选项 */
    export interface SpaceExtension {
        /** 租户空间是否允许匿名读取，即无需访问令牌即可读取空间内容。该扩展选项允许随后修改。 */
        isPublicRead?: boolean;
        /** 媒体库是否为多相簿模式，如果为多相簿模式则必须先创建相簿，才能在相簿中上传媒体资源，否则不允许创建相簿，只能在租户空间根目录中上传媒体资源。该扩展选项不允许随后修改，仅支持在创建租户空间时指定。 */
        isMultiAlbum?: boolean;
        /** 租户空间是否允许上传图片 */
        allowPhoto?: boolean;
        /** 租户空间是否允许上传视频 */
        allowVideo?: boolean;
        /** 文件库允许上传的扩展名，如 .zip, .docx 等，如果不指定或指定为空数组则允许上传所有扩展名的文件。 */
        allowFileExtname?: string[];
        /** 媒体库认定为图片的扩展名，如 .jpg, .png 等，如果不指定或指定为空数组则根据扩展名自动判断是否为常见图片类型。 */
        allowPhotoExtname?: string[];
        /** 媒体库认定为视频的扩展名，如 .mp4, .mov 等，如果不指定或指定为空数组则根据扩展名自动判断是否为常见视频类型。 */
        allowVideoExtname?: string[];
    }

    /**
     * 允许随后修改的扩展选项名，库类型、是否多租户和是否多相簿不允许修改。
     * @private
     */
    export type AllowModifiedExtensionFields = 'isPublicRead' | 'allowPhoto' | 'allowVideo' | 'allowFileExtname' | 'allowPhotoExtname' | 'allowVideoExtname'

    /** 允许随后修改的租户空间扩展选项 */
    export type AllowModifiedSpaceExtension = Pick<SpaceExtension, AllowModifiedExtensionFields>;

    /** 成功创建的租户空间的相关信息 */
    export interface CreateSpaceResult {
        /** 成功创建的租户空间的空间 ID */
        spaceId: string;
    }

    /** 完成创建租户空间的回调函数 */
    export type CreateSpaceCallback = RequestCallback<CreateSpaceResult>;

    /** 分页列出目录参数 */
    export interface ListDirectoryWithPaginationParams {
        /** 目录路径 */
        path: string;
        /** 分页标记，如不指定则从首条开始返回。 */
        marker?: number;
        /** 单页最多条目数，不能超过 1000，如不指定默认为 1000。 */
        limit?: number;
    }

    /** 目录内容条目 */
    export interface DirectoryContent {
        /** 子目录或文件名 */
        name: string;
        /** 条目类型 */
        type: 'dir' | 'file' | 'image' | 'video';
        /** 创建时间 */
        creationTime: Date;
    }

    /** 成功列出的带分页的目录内容信息 */
    export interface ListDirectoryWithPaginationResult {
        /** 当前列出的目录的路径结构 */
        path: string[];
        /** 分页标记，当返回该字段时说明列出的条目有截断，需继续列出后续分页。 */
        nextMarker?: number;
        /** 目录内容条目列表 */
        contents: DirectoryContent[];
    }

    /** 完成分页列出指定目录的回调函数 */
    export type ListDirectoryWithPaginationCallback = RequestCallback<ListDirectoryWithPaginationResult>;

    /** 成功列出的目录内容信息 */
    export type ListDirectoryResult = Omit<ListDirectoryWithPaginationResult, 'nextMarker'>;

    /** 完成列出目录的回调函数 */
    export type ListDirectoryCallback = GeneralCallback<ListDirectoryResult>;

    /** 完成获取 URL 的回调函数 */
    export type GetUrlCallback = GeneralCallback<string[]>;

    /**
     * 上传参数信息
     * @private
     */
    export interface BeginUploadResult {
        /** 上传目标域名 */
        domain: string;
        /** 上传表单字段 */
        form: Query,
        /** 上传确认参数 */
        confirmKey: string;
    }

    /** 成功上传、重命名或移动的目标文件信息 */
    export interface UploadResult {
        /** 目标文件路径结构 */
        path: string[];
    }

    /** 完成上传、重命名移动的回调函数 */
    export type UploadCallback = RequestCallback<UploadResult>;
}

/**
 * 媒资托管后端服务返回的目录内容条目
 * @private
 */
interface DirectoryContentInner extends Omit<MH.DirectoryContent, 'creationTime'> {
    /** 创建时间 */
    creationTime: string;
}

/**
 * 媒资托管后端服务返回的带分页的目录内容信息
 * @private
 */
interface ListDirectoryResultInner extends Omit<MH.ListDirectoryWithPaginationResult, 'contents'> {
    /** 目录内容条目列表 */
    contents: DirectoryContentInner[];
}

export { MH as MediaHosting };
