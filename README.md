腾讯云智能媒资托管的小程序 SDK，使用 TypeScript 编写，自带类型定义并预构建为 JavaScript ES5。

## 安装

```bash
npm install media-hosting-miniprogram-sdk --save
```

## 接口文档

请参阅 [接口文档](https://smart-media-hosting-sdk-doc-1258344699.file.myqcloud.com/mp/globals.html)。

## 使用

- 导入 SDK
```typescript
import { MediaHosting } from 'media-hosting-miniprogram-sdk';
```

- 初始化实例
```typescript
const client = new MediaHosting({
    libraryId: 'smhxxx',
    getAccessToken(params, callback) {
        wx.request({
            // ...
        });
    },
});
```

- 列出相簿
```typescript
client.listDirectory((err, result) => {
    if (err) {
        if (err instanceof MediaHosting.RemoteError) {
            if (err.code === 'SpaceNotFound') {
                return wx.showModal({
                    content: '空间不存在',
                    confirmText: '确定',
                    showCancel: false,
                    success() {
                        wx.redirectTo({ url: '/' });
                    },
                });
            }
            // other Smart Media Hosting error
        } else if (err instanceof MediaHosting.WxRequestError) {
            // WeChat miniprogram error
        }
        // other unhandled error
        return wx.showToast({ icon: 'none', title: err.message, duration: 3000 });
    }
    const contents = result!.contents;
    // ...
});
```

- 上传文件
```typescript
wx.chooseMedia({
    maxDuration: 30,
    sizeType: ['original'],
    success(result) {
        for (const file of result.tempFiles) {
            client.uploadFile([
                albumName, // target album name
                file.tempFilePath.substr(file.tempFilePath.lastIndexOf('/') + 1),
                // get file name rather than full path
            ].join('/'), file.tempFilePath, (err) => {
                if (err) {
                    // upload failed
                    return;
                }
                // upload succeeded
            });
        }
    },
});
```

- 获取相簿封面 URL
```typescript
const albunNameList = contents.map(item => item.name); // string[]
client.getCoverUrl(albumNameList, size, (_err, result) => {
    // ignore error
    result = result || []; // if error occured, result is undefined
    const albums = albumNameList.map((name, index) => {
        return {
            name,
            coverUrl: result![index] || '',
            // note that we didn't handle any error so the coverUrl may be an empty string
        };
    });
    // use albums
});
```

- 全屏查看媒体
```typescript
const media = result!.contents; // listDirectory result
const pathList = media.map(item => [albumName, item.name].join('/')); // string[]
client.getFileUrl(pathList, (err, fileList) => {
    if (err) {
        // handle error
        return;
    }
    client.getPreviewUrl(pathList, (_err, previewList) => {
        // ignore error
        previewList = previewList || [];
        wx.previewMedia({
            sources: media.map((item, index) => {
                return {
                    url: fileList![index],
                    type: item.type,
                    poster: previewList![index] || '',
                };
            }),
            current: index, // current index
        });
    });
});
```
