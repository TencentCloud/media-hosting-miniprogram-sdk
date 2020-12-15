declare class MH {
    private static multiSpaceAccessTokenMapping;
    static getMultiSpaceAccessToken: MH.GetMultiSpaceAccessTokenFunc;
    private _spaceId?;
    private _userId?;
    readonly libraryId: string;
    get spaceId(): string;
    set spaceId(value: string);
    get userId(): string;
    set userId(value: string);
    private readonly getAccessToken;
    private token?;
    private tokenTimestamp;
    private tokenTimer;
    constructor(params: MH.ConstructorParams);
    private static hasError;
    private static checkNeedRefreshToken;
    private static isRemoteError;
    static stringifyQueryString(query: MH.Query): string;
    static encodePath(path: string): string;
    static ensureMultiSpaceToken(libraryId: string, spaceIdList: string[], callback?: MH.GetMultiSpaceAccessTokenCallback): void;
    static ensureMultiSpaceToken(libraryId: string, spaceIdList: string[], userId: string, callback?: MH.GetMultiSpaceAccessTokenCallback): void;
    static getSpaceCoverUrl(libraryId: string, spaceIdList: string[], size?: number, callback?: MH.GetUrlCallback): void;
    private updateToken;
    refreshToken(callback?: MH.GetAccessTokenCallback): void;
    ensureToken(callback?: MH.GetAccessTokenCallback): void;
    ensureToken(forceRenew?: boolean, callback?: MH.GetAccessTokenCallback): void;
    private request;
    createSpace(callback?: MH.CreateSpaceCallback): void;
    createSpace(extension?: MH.SpaceExtension, callback?: MH.CreateSpaceCallback): void;
    updateSpaceExtension(extension: MH.AllowModifiedSpaceExtension, callback?: MH.RequestCallback): void;
    deleteSpace(callback?: MH.RequestCallback): void;
    listDirectoryWithPagination(params: MH.ListDirectoryWithPaginationParams, callback?: MH.ListDirectoryWithPaginationCallback): void;
    listDirectory(callback?: MH.ListDirectoryCallback): void;
    listDirectory(path: string, callback?: MH.ListDirectoryCallback): void;
    createDirectory(path: string, callback?: MH.RequestCallback): void;
    deleteDirectory(path: string, callback?: MH.RequestCallback): void;
    moveDirectory(fromPath: string, toPath: string, callback?: MH.RequestCallback): void;
    getCoverUrl(albumName: string, callback?: MH.GetUrlCallback): void;
    getCoverUrl(albumName: string, size: number, callback?: MH.GetUrlCallback): void;
    getCoverUrl(albumNameList: string[], callback?: MH.GetUrlCallback): void;
    getCoverUrl(albumNameList: string[], size: number, callback?: MH.GetUrlCallback): void;
    private getFileUrlWithQuery;
    getFileUrl(path: string, callback?: MH.GetUrlCallback): void;
    getFileUrl(pathList: string[], callback?: MH.GetUrlCallback): void;
    getPreviewUrl(path: string, callback?: MH.GetUrlCallback): void;
    getPreviewUrl(path: string, size: number, callback?: MH.GetUrlCallback): void;
    getPreviewUrl(pathList: string[], callback?: MH.GetUrlCallback): void;
    getPreviewUrl(pathList: string[], size: number, callback?: MH.GetUrlCallback): void;
    uploadFile(remotePath: string, localPath: string, callback?: MH.UploadCallback): void;
    uploadFile(remotePath: string, localPath: string, force: boolean, callback?: MH.UploadCallback): void;
    deleteFile(path: string, callback?: MH.RequestCallback): void;
    moveFile(fromPath: string, toPath: string, callback?: MH.UploadCallback): void;
    moveFile(fromPath: string, toPath: string, force: boolean, callback?: MH.UploadCallback): void;
}
declare namespace MH {
    class BaseError extends Error {
        constructor(message: string);
    }
    class ParamError extends BaseError {
    }
    class WxRequestError extends BaseError {
    }
    class GetAccessTokenError extends BaseError {
        readonly nestedError: Error | null;
        constructor(nestedError: Error | null);
    }
    class RemoteError extends BaseError {
        readonly status: number;
        readonly code: string;
        constructor(status: number, code: string, message: string);
    }
    class CosError extends BaseError {
        readonly code: string;
        readonly requestId: string;
        constructor(errorXml?: string);
    }
    interface GeneralCallback<T> {
        (err: Error | null, result?: T): void;
    }
    interface AccessToken {
        accessToken: string;
        expiresIn: number;
    }
    interface MultiSpaceAccessToken {
        [spaceId: string]: AccessToken;
    }
    type GetAccessTokenCallback = GeneralCallback<AccessToken>;
    type GetMultiSpaceAccessTokenCallback = GeneralCallback<MultiSpaceAccessToken>;
    interface GetAccessTokenFuncParams {
        libraryId: string;
        spaceId: string;
        userId: string;
    }
    interface GetMultiSpaceAccessTokenFuncParams {
        libraryId: string;
        spaceIdList: string[];
        userId: string;
    }
    interface GetAccessTokenFunc {
        (params: GetAccessTokenFuncParams, callback: GetAccessTokenCallback): void;
    }
    interface GetMultiSpaceAccessTokenFunc {
        (params: GetMultiSpaceAccessTokenFuncParams, callback: GetAccessTokenCallback): void;
    }
    interface ConstructorParams {
        libraryId: string;
        spaceId?: string;
        userId?: string;
        getAccessToken: GetAccessTokenFunc;
    }
    interface Query {
        [name: string]: undefined | string | number | boolean | (undefined | string | number | boolean)[];
    }
    interface RequestParams {
        subUrl: string;
        method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE';
        query?: Query;
        data?: object;
    }
    interface RemoteErrorDetail {
        code: string;
        message: string;
    }
    interface RequestResult<T> {
        statusCode: number;
        data: T;
    }
    type RequestCallback<T = ''> = GeneralCallback<RequestResult<T>>;
    interface SpaceExtension {
        isPublicRead?: boolean;
        isMultiAlbum?: boolean;
        allowPhoto?: boolean;
        allowVideo?: boolean;
        allowFileExtname?: string[];
        allowPhotoExtname?: string[];
        allowVideoExtname?: string[];
    }
    type AllowModifiedExtensionFields = 'isPublicRead' | 'allowPhoto' | 'allowVideo' | 'allowFileExtname' | 'allowPhotoExtname' | 'allowVideoExtname';
    type AllowModifiedSpaceExtension = Pick<SpaceExtension, AllowModifiedExtensionFields>;
    interface CreateSpaceResult {
        spaceId: string;
    }
    type CreateSpaceCallback = RequestCallback<CreateSpaceResult>;
    interface ListDirectoryWithPaginationParams {
        path: string;
        marker?: number;
        limit?: number;
    }
    interface DirectoryContent {
        name: string;
        type: 'dir' | 'file' | 'image' | 'video';
        creationTime: Date;
    }
    interface ListDirectoryWithPaginationResult {
        path: string[];
        nextMarker?: number;
        contents: DirectoryContent[];
    }
    type ListDirectoryWithPaginationCallback = RequestCallback<ListDirectoryWithPaginationResult>;
    type ListDirectoryResult = Omit<ListDirectoryWithPaginationResult, 'nextMarker'>;
    type ListDirectoryCallback = GeneralCallback<ListDirectoryResult>;
    type GetUrlCallback = GeneralCallback<string[]>;
    interface BeginUploadResult {
        domain: string;
        form: Query;
        confirmKey: string;
    }
    interface UploadResult {
        path: string[];
    }
    type UploadCallback = RequestCallback<UploadResult>;
}
export { MH as MediaHosting };
