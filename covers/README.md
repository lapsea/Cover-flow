# covers/

将封面图片（JPG / PNG / WEBP / GIF）放在此目录，启动服务器后会自动加载。

## 文件命名规则

| 格式 | 示例 | 效果 |
|------|------|------|
| `艺术家 - 专辑名.jpg` | `Pink Floyd - The Wall.jpg` | 显示艺术家 + 专辑名 |
| `专辑名.jpg` | `Abbey Road.jpg` | 仅显示专辑名 |

## 启动方式

```bash
npm start
# 然后访问 http://localhost:3000
```

> 此文件夹为空时，应用会自动回退到 albums.json 中的远程封面。
