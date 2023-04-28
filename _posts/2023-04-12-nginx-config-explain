---
layout: post
title: nginx配置详解
subtitle: nginx配置详解
date: 2023-04-12
categories: 技术
# cover: /assets/img/postCover/gulp_cover.png
tags: nginx
---

# Nginx安装配置详解

## Nginx简介

Nginx（“engine x”）是一款高性能的Web服务器和反向代理服务器，它采用事件驱动的异步结构，具有内存占用少、稳定性高、能够处理大量的并发请求，具有高效和低资源消耗的特点。 Nginx常常被用作Web服务器、负载均衡器、反向代理和缓存服务器等。

## Nginx安装

在Ubuntu中，安装Nginx步骤如下：

1. 更新软件源

可以通过运行以下命令更新软件源：

```bash
sudo apt-get update

# 在CentOS中
# sudo yum install epel-release
```

2. 安装Nginx

安装Nginx服务器可以通过以下命令：

```bash
sudo apt-get install nginx

# 在CentOS中
# sudo yum install nginx
```

3. 检查Nginx是否正确安装

运行以下命令可以检查Nginx是否正确安装：

```bash
# 查看nginx版本号
nginx -v

# 查看nginx版本号以及其他配置参数，包含安装、配置文件路径以及内置模块等信息
nginx -V
```

如果能够输出Nginx的版本号，则表示Nginx已经正确安装。

默认情况下，Nginx的安装路径为`/usr/share/nginx`，Nginx的配置文件路径为`/etc/nginx/nginx.conf`。

4. nginx帮助手册命令以及常用命令

```bash
# 查看nginx帮助文档
nginx -h

# 在Linux系统中，可以使用man命令查看nginx详细帮助文档
man nginx

# 检测nginx配置文件语法是否正确
nginx -t

# 检测nginx配置文件语法是否正确，并把nginx配置文件信息输出到屏幕
nginx -T

# 设置nginx使用的配置文件（默认使用：/usr/local/etc/nginx/nginx.conf）
nginx -c nginx_file.conf

# 向nginx主进程发送信号，stop, quit, reopen, reload
nginx -s stop # 停止Nginx进程

nginx -s quit # 快速停止Nginx进程，但允许完成已经接受的连接请求

nginx -s reopen # 重新打开日志文件

# 与stop不同，reload不会完全停止Nginx进程，而是平滑地重新加载配置文件，并在新的工作进程中对已有的连接进行服务，可在不停止服务的情况下实现动态更新配置
nginx -s reload 
```

区别：

stop和quit都是停止Nginx进程，但quit允许之前接受的连接继续完成，而stop则会强制终止所有连接。
reload会重载Nginx的配置文件，并启动新的worker进程，新的worker进程会用新的配置重新跑，旧的worker进程会继续处理旧有的连接，新配置生效后，新的连接会从新的worker进程处理，而reopen是重新打开日志文件，在日志文件较大的时候，方便日志切割。

## 全局内置指令和变量

### Nginx常用的全局指令

1. user：指定Nginx所使用的系统用户和用户组，默认为nobody；
2. worker_processes：指定Nginx工作进程的数量，默认为1；
3. worker_cpu_affinity：指定每个worker进程绑定的CPU核心；
4. worker_rlimit_nofile：指定每个worker进程允许打开的最大文件数；
5. pid：指定Nginx进程号存放的位置，默认为/var/run/nginx.pid；
6. access_log：指定Nginx访问日志存放的位置和格式；
7. error_log：指定Nginx错误日志存放的位置和格式，常用的格式有`debug`，`info`，`notice`，`warn`，`error`和`crit`；
8. events：指定Nginx事件模块的配置，常见的配置包括`worker_connections`（最大连接数）和`use`，`epoll`和`kqueue`，以及其他一些事件模块配置；
9. http：指定Nginx HTTP模块的配置，包括`server_names_hash_max_size`（域名哈希表的最大尺寸）、`server_names_hash_bucket_size`（每个哈希桶的大小）、`client_max_body_size`（前端客户端传输的最大请求体大小）等等；
10. server：指定Nginx所有server块的配置，包括`listen`（服务器监听端口）、`server_name`（服务器域名）、`access_log`（访问日志路径和格式）等等。
11. keepalive_timeout：指定HTTP keep-alive连接超时时间。
12. multi_accept：一个请求是否能够被多个 worker 处理。
13. gzip：是否启用gzip压缩传输；
14. ssl：开启SSL支持；
15. use：添加 nginx 模块；

更多配置信息详见官方文档：https://nginx.org/en/docs/
更多指令详见官方文档：https://nginx.org/en/docs/dirindex.html

### nginx常用的内置变量

1. $request_method：所使用的 HTTP 请求方法，如 GET、POST、PUT、DELETE、HEAD 等。
2. $host: 请求的主机名。
3. $http_referer: 请求的 HTTP referer 头部字段。
4. $http_user_agent: 请求的 User-Agent 头部字段。
5. $remote_addr: 客户端的 IP 地址。
6. $request_body: 请求主体的内容。
7. $request_uri: 请求的 URI 包括参数部分。
8. `$args`: 请求中的参数部分，同`$query_string`。
9. $scheme: 请求使用的协议，比如 http 或 https。
10. $server_name: Nginx 配置中当前虚拟主机的名称。
11. $server_port: Nginx 监听的端口号。

通过使用这些内置变量，可以方便地在Nginx配置中进行动态参数配置、请求头部字段获取等操作。同时，还可以像使用任何其他Nginx变量一样，将它们与各种指令（如if、set、map）结合使用。

以下是Nginx中常用的一些内置变量及其说明：

1. $request_method：所使用的 HTTP 请求方法，如 GET、POST、PUT、DELETE、HEAD 等。

示例：

```nginx
if ($request_method = POST) {
    return 405;
}
```

2. $host：请求头中的主机名，通常用于虚拟主机配置。

示例：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://backend;
    }
}
```

3. $scheme：请求使用的协议，如 http 或 https。

示例：

```nginx
if ($scheme = http) {
    return 301 https://$server_name$request_uri;
}
```

4. $request_uri：请求的完整 URI，包括参数。

示例：

```nginx
location ~ \.php$ {
    fastcgi_pass backend;
    fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    fastcgi_param QUERY_STRING $query_string;
}
```

5. $remote_addr：客户端的IP地址。

示例：

```nginx
geo $blocked_country {
    default no;
    include /etc/nginx/conf.d/blocked_country.txt;
}

server {
    if ($blocked_country) {
        return 403;
    }
}
```

6. $args：请求参数部分的字符串。

示例：

```nginx
location /search/ {
    if ($args ~* "q=(.*)") {
        set $query $1;
    }

    proxy_pass http://backend/search?q=$query;
}
```

7. $http_referer：HTTP 请求头中的 referer 字段，表示从哪个网页链接过来。

示例：

```nginx
if ($http_referer ~* (spamdomain.com|adsite.com)) {
    return 403;
}
```

8. $http_user_agent：HTTP 请求头中的 User-Agent 字段，表示发起请求的客户端使用的浏览器。

示例：

```nginx
if ($http_user_agent ~* "MSIE [1-6]\.") {
    return 403;
}
```

9. $server_name：配置文件中定义的当前虚拟主机名称。

示例：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        root /var/www/example.com;
    }
}
```

10. $server_addr：Nginx 监听的 IP 地址。

示例：

```nginx
server {
    listen 127.0.0.1:8080;
    server_name example.com;

    location / {
        proxy_pass http://backend;
    }
}
```

这些内置变量的详细说明和使用方法可以在官网文档中找到。 
更多内置变量详见官方文档：<https://nginx.org/en/docs/varindex.html>

#### set详细用法

下面是nginx配置自定义变量的详细用法和代码示例：

它的语法为：

```nginx
set $variable value;
```

其中，$variable为变量名，value为变量值，可以是文本、数字、表达式等等。set指令可以在http、server、location、if等块中使用。

需要注意的是，`set`指令只在当前上下文中应用。如果在 http 上下文中设置变量，则它将在整个 Nginx 配置中使用。但是，在 server 和 location 上下文等细分上下文中设置的变量仅在该上下文中使用。变量值的计算是在每个请求中进行的，因此可以在 Nginx 配置中动态地设置变量。此外，您还可以使用nginx的内置变量，例如`$uri`、`$request_method`等，将它们与自定义变量一起使用来构建更复杂的变量。

1. 定义参数变量：

使用set关键字定义参数变量，例如：

```nginx
http {
    #定义全局参数变量
    set $var "/path/to/some/file.txt";
    ...
}
```

2. 使用参数变量：

在配置文件中可以使用$符号引用参数变量，例如：

```nginx
location / {
    ...
    #使用参数变量
    rewrite ^(.*)$ $var;
    ...
}
```

3. 参数变量与字符串拼接：

可以使用``concat``函数将参数变量和字符串拼接起来，例如：

```nginx
http {
    #定义全局参数变量
    set $base_url "https://example.com/";
    ...
}

location / {
    ...
    #将参数变量和字符串拼接起来
    set $img_url "/img/";
    set $full_path "${base_url}$(uri)${img_url}";
    ...
}
```

4. 参数变量与正则表达式：

可以使用参数变量与正则表达式一起使用，例如：

```nginx
location ~* \.(jpeg|jpg|png)$ {
    ...
    #将匹配的文件类型保存到参数变量中
    set $img_type $1;
    ...
}
```

5. 从请求中提取变量值：

```nginx
set $my_var $arg_var;
```

这样就从请求的参数中提取了名为arg_var的变量，并将其值赋给$my_var。

6. 使用表达式计算变量值：

```nginx
set $my_var 10;
set $my_var2 20;
set $my_var3 $my_var+$my_var2;
```

这样就定义了三个变量，`$my_var`的值为10，`$my_var2`的值为20，`$my_var3`的值为它们的和30。

7. 使用map模块设置匹配规则：

```nginx
map $uri $my_var {
    /page1.html "This is page 1.";
    /page2.html "This is page 2.";
    default "This page does not exist.";
}

set $my_var2 $my_var;
```

这样就使用map模块给`$uri`变量匹配规则，如果匹配到了`/page1.html`，则`$my_var`的值为"This is page 1."，否则如果匹配到了`/page2.html`，则`$my_var`的值为"This is page 2."，否则如果没有匹配到任何规则，则`$my_var`的值为"This page does not exist."。在set指令中，我们可以使用`$my_var`来引用这个变量。

通过使用参数变量的方式，我们可以大大简化和优化配置文件中的重复代码和硬编码。下面是一个例子：

```nginx
http {
    #定义全局参数变量
    set $base_url "https://example.com/";
    set $img_url "/img/";
    ...
}

server {
    listen 80;
    server_name example.com;
    #将请求重定向到默认的ssl端口
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name example.com;
    ...
    location / {
        #将请求代理到指定的upstream服务器，并使用参数变量
        proxy_pass ${base_url}upstream;
        ...
    }
    location ~* \.(jpeg|jpg|png)$ {
        #将匹配的文件类型保存到参数变量中，并使用参数变量
        set $img_type $1;
        ...
        add_header Content-Disposition "attachment; filename=${img_type}";
        ...
    }
}
```

需要注意的是，由于使用set指令会增加Nginx的计算负担，因此在配置中不应滥用。若使用过度，可能会导致性能下降或引用其他问题。
总的来说，Nginx的set指令可以用于创建自定义变量，将多个变量组合到一起生成一个新的变量，从而简化配置文件。使用时应当根据具体情况谨慎使用。

#### map详细用法

Nginx map指令用于根据一个或多个变量的值生成映射关系。它可以将一组固定的键值对组合为一个映射表，并在请求到达时使用当前请求的变量值来查找相应的映射值，并将其赋予一个新的变量。通过使用map指令，可以在处理请求之前将复杂的信息逻辑转换为简单的键值对。

map指令的语法如下：

```nginx
map $variable { 
    key value; 
    key value;
    ...
    default value;
}
```

其中，$variable是用于查找对应映射值的变量名。{}内用于定义键值对，每个键值对占一行，其中key为要匹配的值，value为匹配成功后要赋予变量的值。最后必须定义一个default值，当所有key检查完毕后，如果没有匹配到任何值，则会使用default值。

下面是一个map指令的例子：

```nginx
map $request_uri $my_variable {
    "/foo"    "foo";
    "/bar"    "bar";
    "/baz"    "baz";
    default   "nothing";
}
```

在这个例子中，由`$request_uri`指定要匹配的变量名，当`$request_uri`的值为"/foo"、"/bar"、"/baz"时，它们的值将被映射为相应的"foo"、"bar"、"baz"字符串，并赋予`$my_variable`变量。在所有匹配失败的情况下，`$my_variable`的默认值为"nothing"。

map指令支持一些高级特性，例如可以使用正则表达式匹配变量值，使用命名分组；还可以使用include语句包含外部文件，从而方便地组织映射表内容。

需要注意的是，由于map指令会增加Nginx的计算负担，因此在实际使用中，应注意尽量优化映射表和避免使用过度。此外，map指令只能在http、server和location块内使用，并且只有第一次使用时才能定义映射表。

总的来说，Nginx的map指令可以根据一个或多个变量的值生成映射关系，将复杂信息逻辑转换为简单的键值对。使用时应当注意优化映射表和避免使用过度。

## events模块详解

nginx中的events块是一个必须的块，用于配置全局的事件模型和一些系统相关的参数。下面是一个events块的示例代码和注解：

```nginx
events {
  # 设置worker进程数，建议设置为CPU个数的倍数
  worker_processes 4;

  # 每个worker进程连接的最大数
  worker_connections 1024;

  # 使用epoll事件模型，也可以使用kqueue、eventport等
  use epoll;

  # 每个epoll调用可处理的最大连接数，设为on可以提高性能
  multi_accept on;
}
```

其中，注释部分为对应的配置项和解释。需要注意的是，events块中的参数并不是可选的，必须设置。下面是一些需要注意的要点：

1. worker_processes

该参数表示nginx要开启多少个worker进程。建议将其设置为CPU个数的倍数，以充分利用系统的多核性能。

2. worker_connections

该参数表示每个worker进程可以同时处理的最大连接数。一般建议将其设置为最大并发请求数。

3. use

该参数表示要使用哪种事件模型。常用的包括epoll、kqueue、eventport等。默认为select。

epoll是Linux系统中的一个事件驱动机制，当有IO事件发生时，它会通知应用程序，从而减少了不必要的轮询，并提高了性能。
而eventport是Solaris中的一种事件机制。无论是epoll还是eventport，它们都是异步I/O的核心组成部分。

4. multi_accept

该参数表示每个epoll调用可以同时处理的最大连接数。如果设为on，可以提高性能。

总之，正确地配置events块对于保证nginx的稳定、高性能运行非常重要。

## http模块详解

在nginx的配置文件中，http块是最顶层的块，用于配置HTTP协议相关的选项和指令。下面是http块的用法、示例代码和注解：

用法：

```nginx
http {
    // 基本配置指令
    ...
    server {    // server块配置
        // server块内部配置指令
        ...
    }
}
```

示例代码：

```nginx
http {
    # 配置HTTP服务器

    # 定义日志格式
    log_format access '$remote_addr - $remote_user [$time_local] '
                      '"$request" $status $body_bytes_sent '
                      '"$http_referer" "$http_user_agent"';

    # 配置HTTP请求头和HTTP响应头
    include mime.types;
    default_type application/octet-stream;
    server_tokens off;

    # 开启gzip压缩
    gzip on;

    # 配置HTTP请求限制
    limit_req_zone $binary_remote_addr zone=one:10m rate=1r/s;

    # 配置HTTP缓存
    proxy_cache_path /data/nginx/cache levels=1:2 keys_zone=my_cache:10m inactive=60m;
    proxy_cache_key "$scheme$request_method$host$request_uri";
    
    # 配置HTTP反向代理
    upstream backend {
        server 127.0.0.1:8000;
        server 127.0.0.1:8001;
    }
    server {
        listen 80;
        server_name example.com;
        location / {
            proxy_pass http://backend;
            proxy_cache my_cache;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            limit_req zone=one burst=10 nodelay;
        }
    }

    # 配置HTTP服务器的其他选项
    keepalive_timeout 65;
}
```

注解：

- `include` 用来引入其他配置文件，此处引入了mimetypes.types文件，用于设置HTTP请求头和HTTP响应头。
- `default_type` 用来设置默认的mime类型，如果在mimetypes.types文件中找不到对应的类型，则会使用此处设置的类型。
- `server_tokens` 用来控制是否将nginx的版本信息在HTTP响应头中显示，此处为关闭。
- `gzip`：开启gzip压缩，减小传输文件大小，提高文件传输速度。
- `limit_req_zone` 用来设置请求限制，该例子中设置了一个一秒钟只能有一次请求的限制。
- `proxy_cache_path` 用于配置缓存目录和相关参数。
- `upstream` 定义了一个upstream的集群，用于反向代理。
- `server` 定义了一个HTTP服务器，监听80端口，并将指定的域名与upstream集群关联起来。
- `proxy_pass` 配置反向代理，将请求转发到指定服务器。
- `proxy_cache` 用于指定使用的缓存zone。
- `proxy_set_header` 用于设置HTTP请求头。
- `limit_req` 用于限制请求频率，该例子中设置了限制为一秒钟最多处理10个请求，超过则拒绝处理。
- `root`：指定网站的根目录。
- `index`：指定默认访问的页面。
- `location`：针对特定的URI，可以配置子句，如try_files、proxy_set_header、proxy_pass等。其中用/表示网站的根路径，默认不需要配置。

除了以上配置选项，http块还支持其他选项，如ssl等。配置http块后，需要通过nginx -t命令检查配置文件是否正确，并通过nginx -s reload命令重新加载配置文件。

## server模块详解

在Nginx的配置文件中，server块用于定义一个虚拟主机（Virtual Host），它包含了该虚拟主机所需要的所有配置信息，例如监听的端口、域名、TLS证书、反向代理等等。

示例代码：

```nginx
server {
    listen       80;  # 监听端口
    server_name  example.com;  # 域名
    root         /var/www/example.com;  # 网站根目录
    index        index.html index.htm;  # 默认文档

    location / {
        try_files $uri $uri/ /index.html;  # 请求的资源不存在时，返回index.html页面
    }

    location /images/ {
        deny all;  # 禁止外部直接访问该目录下的文件
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;  # 将/api/请求反向代理到本地的8000端口
    }

    error_page  404              /404.html;
    error_page  500 502 503 504  /50x.html;

    location = /50x.html {
        root   /usr/share/nginx/html;
    }

    location ~ \.(gif|jpg|png)$ {
        expires 1d;  # 图片缓存时间为1天
    }

}
```

注解：

1. `listen`：定义该虚拟主机监听的端口，多个端口可以用空格分隔。例如`listen 80;`表示该虚拟主机监听端口为80。

2. `server_name`：定义该虚拟主机对应的域名。例如`server_name example.com;`表示该虚拟主机应对请求的域名为example.com。

3. `root`：定义该虚拟主机的网站根目录。例如`root /var/www/example.com;`表示该虚拟主机对应的站点根目录为/var/www/example.com。

4. `index`：定义该虚拟主机的默认文档。例如`index index.html index.htm;`表示该虚拟主机默认显示index.html或index.htm页面。

5. `location`：定义该虚拟主机对请求的URL路径匹配规则和配置信息。

6. `try_files`：在当前location中匹配的所有URI都无法找到时，Nginx会一次尝试它们，处理第一个匹配并未在文件系统上找到的 URI。

7. `deny all`：禁止外部直接访问该目录下的文件。

8. `proxy_pass`：将请求反向代理到本地的具体端口。例如`proxy_pass http://127.0.0.1:8000;`表示该虚拟主机对/api/请求的反向代理到本机的8000端口。

9. `error_page`：定义错误页面，例如404.html和50x.html。

10. `location = /50x.html`：匹配URL路径为/50x.html的请求，返回/usr/share/nginx/html目录下的50x.html页面。

11. `expires`：定义该虚拟主机的缓存时间。例如`expires 1d;`表示该虚拟主机对图片的缓存时间为1天。

在Nginx的配置文件中，可以有多个server块，每个块都对应一个虚拟主机。当有请求到达Nginx时，Nginx会根据请求所指定的域名，找到对应的server块，并将请求转发到该虚拟主机配置所指定的处理方式。

### root和alias的区别

`root` 和 `alias` 都是 Nginx 中用来指定静态文件根目录的指令，但它们的用法和效果是不同的。

#### root

`root` 指令用于指定 Nginx 服务器的主机根目录，即静态文件存放的根目录，例如：

```nginx
server {
    listen 80;
    server_name example.com;
    root /var/www/html;
    ...
}
```

上面的配置中，访问 example.com 的请求会被映射到 `/var/www/html` 目录，Nginx 会在该目录下寻找网站需要的静态资源。

如果 URL 中包含路径，Nginx 会将路径追加到 `root` 指定的根目录后面。例如，请求 `http://example.com/static/img/logo.png` 会被映射到 `/var/www/html/static/img/logo.png` 文件。

#### alias

`alias` 指令用于指定某个 URI 映射到服务器本地的一个实际路径，例如：

```nginx
location /static/ {
    alias /var/www/static/;
    ...
}
```

上面的规则将所有以 `/static/` 开头的请求映射到 `/var/www/static/` 目录下，例如请求 `http://example.com/static/img/logo.png` 会被映射到 `/var/www/static/img/logo.png` 文件。

#### 注意事项

使用 `root` 指令时，URI 中的路径会被添加到指定的根目录后面，并作为访问文件的完整路径。因此，你需要确保每个目录都存在于正确的位置，否则会出现404错误。

使用 `alias` 指令时，URI 中的部分路径会被替换成实际的文件路径，因此你需要确保别名路径的设置是正确的，否则会出现404错误。此外，在使用 `alias` 指令时，还需要注意下面一些事项：

- `alias` 路径末尾一定要加上 `/`，否则可能出现404错误。
- 需要修改 `location` 块内的 `try_files` 指令，指定正确的文件访问路径。
- 使用 `alias` 指令时，相对路径和绝对路径的行为是不同的。如果 alias 路径是到上级目录或者相对路径，那么就需要在指令末尾加上斜杠(/)。

与 `root` 不同的是，使用 `alias` 指令可以将 URI 指向任意目录，而不仅仅是指向 `root` 指定的根目录。同时，使用 `alias` 指令也可以避免 URI 路径与服务器路径的混淆问题。

总之，`root` 和 `alias` 都是用于指定静态文件根目录的指令，但它们的区别在于 `root` 只有一个根目录，而 `alias` 可以为不同 URI 指向不同的目录，并且在处理带有路径的 URI 时，两者的行为也是不同的。通过使用 `alias` 指令，可以轻松为不同的 URI 指向不同的目录，提高 Nginx 的灵活性和扩展性。

## location模块详解

Nginx中的location指令用于匹配URI，以便能够在不同的配置块中应用不同的指令集。在location中使用不同的匹配规则能够达到不同的目的，比如反向代理、负载均衡、静态资源处理等。

以下是location指令的语法格式：

```nginx
location [区分大小写][ = | ~ | ~* | ^~ ] uri {
    ...
}
```

其中：

- 精确匹配：在location指令的URI前面使用“=”，表示精确匹配：

```nginx
location = /login {
    ...
}
```

- 前缀匹配：在location指令的URI前面使用“^~”，表示前缀匹配：

```nginx
location ^~ /images/ {
    ...
}
```

- 区分大小写：在location指令的URI前面使用“~”，表示区分大小写：

```nginx
location ~ /blog {
    ...
}
```

- 不区分大小写：在location指令的URI前面使用“~*”，表示不区分大小写：

```nginx
  location ~* \.(gif|jpg|jpeg)$ {
    ...
}
```

下面分别给出这些不同匹配规则的说明注释、示例代码以及优先级。

### 精确匹配

精确匹配使用“=”符号，表示只有URI完全匹配时才会执行指定的location块中的指令，这种方式的匹配优先级最高。

示例代码：

```nginx
location = /login {
    proxy_pass http://127.0.0.1:8080/login;
}
```

此时，只有URI为“/login”的请求才会被匹配到这个location块中。

### 前缀匹配

前缀匹配使用“^~”符号，表示只有当URI以指定的前缀开头时才会执行指定的location块中的指令，这种方式的匹配优先级比正则匹配高。

示例代码：

```nginx
location ^~ /static/ {
    root /var/www;
}
```

此时，所有以“/static/”开头的URI都将被匹配到这个location块中。

### 正则匹配（区分大小写）

区分大小写的正则匹配使用“~”符号，表示只有符合正则表达式的URI才会被匹配到这个location块中。

示例代码：

```nginx
location ~ /blog/post/\d+ {
    root /var/www/blog/;
}
```

此时，所有形如“/blog/post/”+一个或多个数字的URI都将被匹配到这个location块中。

### 正则匹配（不区分大小写）

不区分大小写的正则匹配使用“~*”符号，表示只有符合正则表达式的URI才会被匹配到这个location块中，这种方式的匹配优先级最低。

示例代码：

```nginx
location ~* \.(gif|jpg|jpeg)$ {
    root /var/www/images/;
}
```

此时，所有以“gif”、“jpg”或“jpeg”结尾的URI都将被匹配到这个location块中。

### 最优匹配

```nginx
location / {
    # 此处为默认匹配规则，将所有无法匹配到以上 URI 的请求均指向 index.html
    try_files $uri $uri/ /index.html;
}
```

总结：

location模块是Nginx用来匹配URL路径的模块之一，其匹配规则和优先级如下：

1. 精确匹配：当location模块的模式为一个完整的URI时，只有完全匹配该URI时才会执行该location块中的指令，其优先级最高。

2. 前缀匹配：如果location块的模式没有以“= ”开始，而是以"^~"或者“/”开始，则表示该location块的模式为一个前缀字符串。当请求的URI与该前缀字符串匹配时，将会执行该location块中的指令，如果URI匹配多个前缀字符串，则选择最长匹配的前缀字符串，其优先级次于精确匹配。

3. 正则匹配：当location块的模式为一个正则表达式时，如果请求的URI与该正则表达式匹配，则会执行该location块中的指令。如果多个location块的正则表达式都能匹配请求的URI，则选择第一个匹配成功的location块，其优先级低于前缀匹配。

4. 最优匹配：当location块的模式为“/”时，表示匹配所有请求，但是其优先级最低，只有当前面的三种匹配方式都无法匹配该请求时，才会执行该location块中的指令。

需要注意的是，如果多个location块都匹配当前请求的URI，那么只会执行其中优先级最高的那个location块中的指令；如果两个location块的优先级相等，则选择前面的location块。

可以看出，Nginx的location指令可以通过不同的匹配规则，实现对不同URI的处理。匹配规则之间的优先级是从高到低的精确匹配 > 前缀匹配 > 正则匹配（区分大小写）> 正则匹配（不区分大小写）> 最优匹配最后。根据不同的需求进行选择，可以最大限度地提高Nginx的性能和效率。

## proxy模块

在Nginx中使用proxy模块可以实现反向代理的功能，即将客户端的请求转发到后端服务器进行处理，并将后端服务器返回的响应返回给客户端。

proxy模块提供了以下常用的指令：

- proxy_pass：设置反向代理的目标服务器地址，可以是IP地址或域名，支持http、https、fastcgi、uwsgi、scgi等协议。实现反向代理的核心指令。
- proxy_set_header：设置向后端服务器发送的HTTP请求头信息。可以设置多个header信息，如Host、User-Agent、Referer等。
- proxy_connect_timeout：设置连接后端服务器的超时时间。
- proxy_read_timeout：设置从后端服务器读取响应数据的超时时间。
- proxy_send_timeout：设置向后端服务器发送请求的超时时间。
- proxy_buffering：开启或关闭代理服务器对后端服务器的响应缓存。如果开启，则需要配合proxy_buffer_size和proxy_buffers指令来控制缓存大小。
- proxy_cache：开启或关闭代理服务器对后端服务器响应的缓存。如果开启，则需要配合proxy_cache_path指令来设置缓存路径和缓存参数。
- proxy_redirect：配置代理服务器对后端服务器响应的重定向规则。

下面是一个简单的反向代理示例，将客户端请求转发到后端服务器进行处理，然后将后端服务器返回的响应返回给客户端：

```nginx
server {
    listen       80;
    server_name  example.com;

    location /api {
        proxy_pass http://backend_server;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

- 通过listen指令设置端口号为80。
- 通过server_name指令设置主机名为example.com。
- 通过location指令匹配请求的uri为`/api`，并将这个uri转发到后端服务器`http://backend_server`进行处理。
- 通过proxy_set_header指令，将客户端的Host、X-Real-IP、X-Forwarded-For信息发送给后端服务器。
- 注意：如果你的代理服务器没有权限访问到后端服务器，nginx将返回502 Bad Gateway 或者504 Gateway Timeout 错误。此时需要检查代理服务器是否与后端服务器的网络环境通畅。

## upstream模块

在 Nginx 配置文件中，upstream 模块用于定义一组后端服务或服务器的列表，可以用来负载均衡和故障转移。以下是upstream配置块的示例代码以及注解：

```nginx
upstream backend {
    # 定义一组名为backend的后端服务器列表
    server 127.0.0.1:8080;
    server 127.0.0.1:8081;
    server 127.0.0.1:8082;
    # 默认的算法为轮询，其他算法包括ip_hash、random、least_conn和hash等
    # ip_hash：根据客户端IP地址进行哈希的负载均衡算法；
    # keepalive：启用长连接，提高传输效率；
    # max_fails：表示最大失败次数；
    # fail_timeout：表示断开连接的时间间隔；
    # backup：表示备用服务器。
    # 关于各个算法的详细说明可以参考官方文档：http://nginx.org/en/docs/http/ngx_http_upstream_module.html
    # 也可以在server配置中单独指定，如：server backend1 weight=5 max_fails=3 fail_timeout=10s;
    # 其中weight表示权重，max_fails和fail_timeout用于故障转移的判断，weight越大的后端服务器，获取的请求越多
    # max_fails表示在fail_timeout时间内出现的最大失败次数
    # fail_timeout表示在被标记为失败之前的时间，出现的最大失败次数，当一个后端服务器被标记为失败时，不再把请求负载给它，直到过了fail_timeout时间，如果一个后端服务器被标记为失败，但是在fail_timeout时间内又恢复了正常那么它将重新参与负载均衡
    # 如果所用的算法是ip_hash，则会根据客户端IP地址的HASH值来选择后端服务器，这样可以保证同一客户端的请求会被转发到同一台后端服务器上
    # 自动发现的机制：添加了一个新的后端服务器或失去联系的服务器在指定时间内自动被删除，默认值：10秒
    # 还有一个keepalive机制，用于复用后端连接，减少建立连接的开销
    # 可以在http块中定义默认的参数
    # keepalive 8;
    # keepalive_timeout表示保持连接时间(默认75秒)
    # keepalive_requests表示单个连接最大请求数(默认100)
    # 这些参数可以通过nginx -V命令查看
    # 可以为每个upstream块单独指定一组参数
    # 如：upstream backend {
    #          keepalive 64;
    #          keepalive_timeout 65s;
    #          keepalive_requests 100;
    #      }
    # 如果没有指定，则沿用http块中的参数
}
```

在实际应用中，我们可以通过在 server 配置中引用 upstream 名称来使用上面定义的后端服务器列表，实现负载均衡和故障转移。

示例代码：

```nginx
http {
    upstream backend {
        server 127.0.0.1:8080;
        server 127.0.0.1:8081;
        server 127.0.0.1:8082;
    }
 
    server {
        listen       80;
        server_name  localhost;
 
        location / {
            proxy_pass  http://backend;
            # 将客户端的请求转发到backend定义的一组后端服务器中的一个
            # 如果其中某个后端服务器标记为失败，则会选择其他可用的后端服务器
        }
    }
}
```

## rewrite指令详解

在Nginx中，rewrite块是一种用于重写URL的指令。它可以让URL匹配一个正则表达式，并按照一定规则重写URL。下面是rewrite块的详细用法、示例代码和注解。

### 语法

```nginx
rewrite regex replacement [flag];
```

`regex`：正则表达式，用于匹配需要被重写的URL。

`replacement`：重写规则，在匹配成功后，将被替换的URL。

`flag`：可选的标志，用于指定rewrite行为的不同方面。

### 示例代码

```nginx
location /new-location/ {
  rewrite ^/new-location/(.*)$ /old-location/$1 break;
}
```

这段代码中，定义了一个名为 `/new-location/` 的 location 块，用于对该页面的请求进行处理。其中，使用了 rewrite 指令对请求的 URI 进行了修改。

`^/new-location/(.*)$` 表示使用正则表达式匹配 URI，其中 `^` 和 `$` 表示匹配起始和结束位置，`/new-location/` 表示匹配 URI 的开头部分，`(.*)` 表示匹配 URI 的其余部分，并将匹配结果存储在变量 $1 中。

`/old-location/$1` 表示将匹配到的 URI 的其余部分添加在 `/old-location/` 后，结果作为修改后的 URI。

break 参数表示在重写 URI 之后停止处理当前请求，不再继续执行下面的 location 指令。

因此，对于请求 `/new-location/path/to/resource`，会被重写为 `/old-location/path/to/resource`。

需要注意的是，rewrite 指令可以出现在 server、location 等块中，也可以使用 flag 参数来控制重写行为，如 last、redirect 等。其中，last 表示在进行 URI 重写之后，重新开始新一轮的 URI 处理，而 redirect 表示将这个请求重定向到另一个 URL。

### rewrite可选参数详解

在nginx的rewrite模块中，有几个常用的参数，包括：

- `break`：停止执行当前的rewrite指令集，然后开始执行下一个指令集；
- `last`：停止执行当前的rewrite指令集，然后重新执行nginx的location匹配；
- `redirect`：发送302临时重定向状态码；
- `permanent`：发送301永久重定向状态码。

下面我们解释一下它们之间的区别：

- `break`：停止执行当前的rewrite指令集，但是不对uri进行重定向，nginx将继续执行下一条指令。使用这个指令通常是为了防止uri被重写多次。
示例代码：

```nginx
location /admin/ {
  rewrite ^(/admin)(.*)$ $1/index.html break;
  proxy_pass http://backend/;
}
```

在这个例子中，如果uri匹配到/admin/，则将/admin/重写为/admin/index.html，然后继续执行proxy_pass指令。

- `last`：停止执行当前的rewrite指令集，重新执行nginx的location匹配，即再次进入location块中查找匹配的uri，并将uri放入到新的指令集中执行。使用这个指令可以实现在rewrite过程中动态改变uri或指定新的location处理请求。
示例代码：

```nginx
location /old/ {
  rewrite ^/old/(.*)$ /new/$1 last;
}

location /new/ {
  proxy_pass http://backend/;
}
```

在这个例子中，如果uri匹配到`/old/`，则将`/old/`后的内容重写为`/new/`后的内容，然后重新匹配uri，进入到`/new/`的location块中继续处理请求。

- `redirect`：发送302临时重定向状态码，将客户端的请求重定向到新的uri，客户端会发送新的请求。使用这个指令可以实现uri重定向，但不会改变浏览器的地址栏。
示例代码：

```nginx
rewrite ^/login$ /user/login.html redirect;
```

在这个例子中，如果uri匹配到`/login`，将发送302临时重定向状态码，将客户端重定向到`/user/login.html`。

- `permanent`：发送301永久重定向状态码，将客户端的请求永久重定向到新的uri，客户端会发送新的请求。使用这个指令可以实现uri重定向，并且会改变浏览器的地址栏。
示例代码：

```nginx
rewrite ^/old/(.*)$ /new/$1 permanent;
```

在这个例子中，如果uri匹配到`/old/`后面跟着任意字符，将发送301永久重定向状态码，将客户端重定向到`/new/`后面跟着同样的任意字符。

## access模块

nginx access模块用于控制客户端请求的访问权限。通过配置，可以限制只有指定的IP地址或CIDR的请求才能够被处理，而其它请求则会被拒绝。

该模块的用法非常灵活，可以在全局作用域、server作用域或location作用域下使用。以下是详细的用法说明：

### 全局作用域

在nginx配置文件的全局作用域中使用access模块，会将其作用于所有server模块和location模块。示例代码如下：

```nginx
http {
    ...
    # 访问控制配置
    include /path/to/access.conf;
    ...
}
```

其中，access.conf是一个单独的配置文件，该文件中包含了一些access模块的具体配置。在这个文件中，可以使用allow和deny指令来进行IP地址的访问控制。

### server作用域

在server作用域中使用access模块，可以针对指定的server块进行访问控制。示例代码如下：

```nginx
server {
    listen 80;
    server_name example.com;
    ...
    # 访问控制配置
    allow 192.168.1.0/24;
    deny all;
    ...
}
```

在这个配置中，只有192.168.1.0/24网段的IP地址可以访问example.com域名下的资源，其它IP地址则会被拒绝。

### location作用域

在location作用域中使用access模块，可以针对特定的URL路径进行访问控制。示例代码如下：

```nginx
location /admin/ {
    # 访问控制配置
    allow 192.168.1.100;
    deny all;
    ...
}
```

在这个配置中，只有192.168.1.100的IP地址可以访问/admin/路径下的资源，其它IP地址则会被拒绝。

基于以上示例代码，下面详细解释access模块中各个指令的含义和用法：

### allow指令

allow指令表示允许指定的IP地址或CIDR进行访问。该指令可以配置多个IP地址或CIDR，用空格隔开。示例代码如下：

```nginx
allow 192.168.1.100;
allow 10.0.0.0/24;
```

以上配置表示允许192.168.1.100和10.0.0.0/24网段下的IP地址进行访问。

需要注意的是，如果同时配置了多个allow指令，那么所有指令的效果会叠加。也就是说，如果有任意一个allow指令允许了该IP访问，那么该IP就可以访问资源。

### deny指令

deny指令表示禁止指定的IP地址或CIDR进行访问。该指令的用法和allow指令类似，示例代码如下：

```nginx
deny 192.168.1.0/24;
deny 10.0.0.100;
```

以上配置表示禁止192.168.1.0/24网段下的IP地址和10.0.0.100的IP地址进行访问。

需要注意的是，deny指令的优先级高于allow指令。也就是说，如果一个IP地址既符合allow指令的配置，又符合deny指令的配置，那么该IP地址将被拒绝访问。

### all指令

all指令表示允许或禁止所有IP地址进行访问。该指令和allow和deny指令搭配使用，示例代码如下：

```nginx
allow all;
den all;
```

以上配置分别表示允许或禁止所有IP地址进行访问。

需要注意的是，all指令在deny指令中的优先级高于allow指令。也就是说，如果同时配置了allow all和deny all指令，那么所有IP地址都会被拒绝访问。

综上所述，access模块是nginx中非常常用的一个模块，可以帮助管理员实现灵活的访问控制策略。需要根据实际场景进行配置，具体使用时请参考以上示例代码。

## include模块

在Nginx的配置文件中，include模块可以让我们将多个配置文件分开管理，便于阅读和维护。下面是include模块的详细用法、示例代码以及注解：

1. 用法：包含指定的文件，实现配置文件的模块化管理。

```nginx
#示例配置代码
http {
    include /etc/nginx/mime.types;
    include /etc/nginx/conf.d/*.conf;
}
```

使用 include 引入的文件格式要求和 nginx 配置文件格式一致，即每条指令以分号结尾，每段配置以大括号包围。同时，需要注意避免在 included 文件中重复定义已有的指令，以免引起配置不一致的问题。

2. 示例代码：

我们的Nginx服务器可能需要配置多个虚拟主机，并且每个虚拟主机都有一些共同的配置，同时还有针对不同虚拟主机的独特的配置。这时可以使用include模块来将共同的配置和不同的配置分开管理。

例如，我们可以将共同的配置放在一个文件中，比如common.conf：

```nginx
# common.conf
listen 80;
location / {
    try_files $uri $uri/ =404;
}
```

接着，在每个虚拟主机的配置文件中，我们可以使用include指令来引入common.conf，然后再进行独特的配置：

```nginx
# site1.conf
server {
    server_name site1.com;
    include common.conf;
    location / {
        proxy_pass http://127.0.0.1:8080;
    }
}

# site2.conf
server {
    server_name site2.com;
    include common.conf;
    root /var/www/site2;
    index index.html;
}
```

在这个配置中，我们通过include指令将common.conf引入到每个虚拟主机的配置文件中，从而避免了重复的配置。同时，我们还可以在不同的配置文件中添加独特的配置，确保不同的虚拟主机能够按照自己的需求工作。

3. 注解：

在上面的例子中，我们可以发现include指令同样可以用来引入Nginx的其他配置文件，比如mime.types（定义MIME类型）、fastcgi.conf（定义FastCGI参数）等。使用include模块可以让我们更方便地管理Nginx的配置文件，而不需要将所有的配置都写在同一个文件中，从而大大提高了可读性和可维护性。

## ssl模块

nginx的ssl模块用于启用HTTPS协议，配置SSL/TLS加密，以保护网站的安全性。以下是ssl模块的详细用法、示例代码和注解：

```nginx
# 配置nginx使用的SSL证书和私钥
ssl_certificate /path/to/ssl.crt;
ssl_certificate_key /path/to/ssl.key;

# 配置ssl协议和加密算法
ssl_protocols TLSv1.2 TLSv1.3; # 指定支持的TLS/SSL协议版本
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384; # 配置加密算法
ssl_prefer_server_ciphers on; # 指定使用服务器端选择的加密算法

# 配置SSL会话缓存
ssl_session_cache shared:SSL:10m; # 指定缓存大小和名称
ssl_session_timeout 5m; # 指定缓存过期时间

# 配置ssl安全相关选项
ssl_stapling on; # 开启OCSP状态响应
ssl_stapling_verify on; # 验证OCSP响应的有效性
ssl_trusted_certificate /path/to/trust.crt; # 配置CA证书用于验证客户端证书

# 配置ssl代理相关选项
proxy_ssl_server_name on; # 开启SSL Server Name Indication
proxy_ssl_session_reuse on; # 开启SSL会话重用
proxy_ssl_protocols TLSv1.2 TLSv1.3; # 配置支持的协议版本

# 配置ssl客户端证书认证
ssl_client_certificate /path/to/ca.crt; # 配置CA证书
ssl_verify_client on; # 开启客户端证书认证
ssl_verify_depth 2; # 配置验证链最大深度

# 配置ssl限速
limit_rate 100k; # 指定限速速率
limit_rate_after 5m; # 指定限速开始时间
```

注解：

- ssl_certificate和ssl_certificate_key分别配置SSL证书和私钥。
- ssl_protocols和ssl_ciphers：分别配置支持的SSL/TLS协议版本和加密算法。
- ssl_prefer_server_ciphers指定是否使用服务器端选择的加密算法。
- ssl_session_cache和ssl_session_timeout分别配置SSL会话缓存大小和过期时间。
- ssl_stapling开启OCSP状态响应，ssl_stapling_verify验证OCSP响应的有效性。
- ssl_trusted_certificate配置CA证书用于验证客户端证书。
- proxy_ssl_server_name开启SSL Server Name Indication（SNI），proxy_ssl_session_reuse开启SSL会话重用，proxy_ssl_protocols配置支持的协议版本。
- ssl_client_certificate配置CA证书，ssl_verify_client开启客户端证书认证，ssl_verify_depth配置验证链的最大深度。
- limit_rate和limit_rate_after配置SSL限速。

## gzip模块

在nginx的配置文件中，可以使用gzip模块来开启gzip压缩功能，从而减少传输数据的大小，提升网站的性能和响应速度。

### 以下是几个gzip参数的说明

- gzip_types：指定需要使用gzip算法压缩的MIME类型，默认是"text/html"。
- gzip_vary：告诉代理服务器使用gzip压缩之后，要添加Vary: Accept-Encoding头信息。
- gzip_proxied：指定启用gzip压缩的请求类型。
- gzip_comp_level：指定gzip压缩的级别，压缩级别越高，压缩比例越高，耗时也会相应变长，范围是1-9（9最高）。
- gzip_buffers：设置压缩缓冲区数量和大小。
- gzip_http_version：指定响应的最小HTTP版本，如果比该版本低则不启用压缩。
- gzip_disable：禁用用户代理，如某些旧版Internet Explorer浏览器，不支持gzip压缩。

### 具体的用法如下

```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_min_length 1024;
```

其中，gzip指令开启gzip压缩功能，gzip_types指令指定需要压缩的文件类型，gzip_min_length指令指定了最小压缩文件大小。需要注意的是，gzip_types指令中指定的文件类型必须是MIME类型，格式为type/subtype，多个文件类型之间用空格分隔。

下面是一个具体的示例代码：

```nginx
http {
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;
    ...
}
```

上述代码中，我们开启了gzip压缩，并指定了需要压缩的文件类型。对于大小小于1024字节的文件，nginx不会进行gzip压缩。

### 测试gzip模块

可以使用curl命令来测试gzip模块是否生效。具体命令是：

```bash
curl -I -H "Accept-Encoding: gzip" http://example.com
```

该命令将显示HTTP响应头信息，包括Content-Encoding：gzip头，表示已经经过gzip压缩。

需要注意的是，开启gzip压缩功能需要消耗一定的CPU资源。因此，一般情况下建议只针对一些体积较大的静态资源进行gzip压缩，以提升性能和响应速度。同时，也需要注意gzip压缩并不是适用于所有情况，例如图片、音视频等二进制文件可能并不适合压缩。因此，在使用gzip压缩时，需要根据具体情况进行调整和优化。

## geo模块

NGINX Geo模块是用于处理IP地址和地理位置信息的模块，该模块能够根据IP地址的地理位置进行条件分支控制，以便实现不同的请求转发、限制访问等功能。下面是一些示例代码：

1. 根据地理位置进行请求转发

```nginx
# 定义一个geo变量，用来匹配地址对应的地理位置，并分配一个默认值
geo $region {
   default unknown;
   192.168.1.0/24 local;
   172.16.0.0/12 internal;
   10.0.0.0/8 internal;
   180.169.0.0/16 china;
   192.168.0.0/16 lan;
}

server {
   listen 80;
   server_name example.com;

   location / {
       # 根据$region匹配成功的值，进行条件判断并进行相应的请求转发
       if ($region = china) {
           proxy_pass http://china_servers;
       }
       if ($region = internal) {
           proxy_pass http://internal_servers;
       }
       if ($region = local) {
           proxy_pass http://local_servers;
       }
       proxy_pass http://default_servers;
   }
}
```

2. 根据地理位置限制访问

```nginx
# 定义一个geo变量，用来匹配白名单的IP地址，分配一个默认值为0
geo $white_list {
    default 0;
    180.169.0.0/16 1;
}

server {
    listen 80;
    server_name example.com;

    # 如果$white_list匹配成功，则返回403错误信息，否则正常进行请求处理
    if ($white_list) {
        return 403;
    }
}
```

以上示例代码均是简单的示例，实际应用中还需要结合具体场景灵活运用。

## 总结

本文详细的介绍了nginx的安装、常用模块的配置以及用法，希望各位小伙伴看完这篇文章以后都能熟练使用nginx配置，如这篇文章对你有帮助，欢迎点赞收藏关注三连，以资鼓励，谢谢！
