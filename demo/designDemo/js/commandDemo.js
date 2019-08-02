(function (window, document) {
    var button1 = document.getElementById('button1');
    var button2 = document.getElementById('button2');
    var button3 = document.getElementById('button3');

    var setCommand = function (button, command) {
        button.onclick = function () {
            command.execute();
        }
    }
    
    var MenuBar = {
        refresh: function () {
            console.log('刷新菜单目录');
        }
    }
    
    var SubMenu = {
        add: function () {
            console.log('增加子菜单');
        },
        del: function () {
            console.log('删除子菜单');
        }
    }
    
    var RefreshMenuBarCommand = function (receiver) {
        this.receiver = receiver;
    }
    RefreshMenuBarCommand.prototype.execute = function () {
        this.receiver.refresh();
    }
    var AddSubMenuCommand = function (receiver) {
        this.receiver = receiver;
    }
    AddSubMenuCommand.prototype.execute = function () {
        this.receiver.add();
    }
    var DelSubMenuCommand = function (receiver) {
        this.receiver = receiver;
    }
    DelSubMenuCommand.prototype.execute = function () {
        this.receiver.del();
    }
    
    var refreshMenuBarCommand = new RefreshMenuBarCommand(MenuBar);
    var addSubMenuCommand = new AddSubMenuCommand(SubMenu);
    var delSubMenuCommand = new DelSubMenuCommand(SubMenu);
    setCommand(button1, refreshMenuBarCommand);
    setCommand(button2, addSubMenuCommand);
    setCommand(button3, delSubMenuCommand);

    // 使用闭包实现命令模式
    // var setCommand = function (btn, fn) {
    //     btn.onclick = function () {
    //         fn();
    //     }
    // }
    
    // var MenuBar = {
    //     refresh: function () {
    //         console.log('刷新菜单界面！！！');
    //     }
    // }
    
    // var RefreshMenuBarCommand = function (receiver) {
    //     return function () {
    //         receiver.refresh();
    //     }
    // }
    
    // var refreshMenuBarCommand = RefreshMenuBarCommand(MenuBar);
    
    // setCommand(button1, refreshMenuBarCommand);

})(window, document);
