var fs = require('fs'); // 文件系统
var path = require('path'); // 路径处理

/**
 * @param { dir：string，文件夹名称}
 * @return {dir文件夹下的文件夹名称数组}  
 */
function getFolders (dir) {
    return fs.readdirSync(dir)
        .filter(function (file) {
            return fs.statSync(path.join(dir, file)).isDirectory();
        })
}
console.log(getFolders('demo'));