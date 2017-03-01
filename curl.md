目标
====
本文档意在阐述使用libcurl编程时的一般原则和一些基本方法。本文档主要关注c接口，但也同样适用与其它语言接口，通常都与c很相似。
本文档提及`用户`，是指使用libcurl进行编程的人。这可能是你，或与你处于同一情形的人。本文提及的`该程序`，指的是你基于libcurl之上在编写的代码。`该程序`与libcurl相互独立
要获取关于本文档提及的选项和函数更多的信息，请访问对应的帮助手册

编译
====
有许多不同方式编译c程序。本章假设使用的是类Unix编译工具。如果你使用了不同的编译系统，你也同样可以阅读本章获取通用信息，可能同样适用于你的环境

编译程序
------
你的编译器需要知道libcurl头文件的位置。所以你必须在编译器头文件路径中包含安装路径。`curl-config`[3]可以用来获取该信息：

	$ curl-config --cflags
将程序链接到curl
------
当编译程序的时候，需要链接目标文件生成可执行文件。你需要链接libcurl，以及libcurl可能依赖的其它库，例如OpenSSL库，甚至一些标准操作系统库也同样需要。为了明确需要哪些flags，还是可以通过`curl-config`工具：

	$ curl-config --libs
是否使用SSL
------
libcurl可以以多种方式编译和定制化。其中使用库和编译差别较大的是是否支持基于SSL，如 HTTPS 和 FTPS。如果在编译期间检测到需要SSL库，libcurl会集成支持SSL。要明确安装的libcurl是否内置支持SSL，这样运行`curl-config`：

	$ curl-config --feature
如果支持SSL，`SSL`关键字将打印到标准输出 stdout，可能与支持的其它特性一起，为不同版本的libcurls，启用或未启用
同样可以在下面 "libcurl支持的特性" 中还有描述

autoconf 宏
------
当你在写检测libcurl及相关启动变量的配置脚本时，我们提供了一个预写好的宏，可能提供了你需要的所有功能。查看 `docs/libcurl/libcurl.m4` 文件，描述了如何使用该宏

多平台的可移植代码
------
libcurl背后的人付出相当大的努力，使libcurl可以在大量不同操作系统和环境下工作
你可以在libcurl运行的所有平台上以同样方式使用libcurl。只有非常少的例外情况。只要你能保证便携代码足够可移植，你就可以很好的编写可移植程序。libcurl不会成为阻碍。

全局准备
===
程序需要全局初始化一些curl提供的函数。这意味着无论你要使用库函数多少次，只能初始化一次。一旦你的程序生命周期开始，就需要完成：

	curl_global_init()
它接收一个位模式的参数，告诉libcurl如何初始化。使用`CURL_GLOBAL_ALL`将使得libcurl初始化它所知道的所有子模块，而这可能是一个很好的默认选择。当前2位这样定义的：

	CURL_GLOBAL_WIN32
只适用于Windows系统。当在Windows机器上运行时，会使libcurl初始化win32 socket相关。没有进行正确的初始化，你的程序可能不能正常使用sockets。你应该在每一个应用中只初始化一次，如果你的程序或者使用到的其它库已经初始化过了，你同样不需要让libcurl再来一遍

	CURL_GLOBAL_SSL
它只在编译时集成了对SSL支持的libcurl中生效。在这些系统中，这会使得libcurl为应用正确的初始化SSL库。你应该在每一个应用中只初始化一次，如果你的程序或者使用到的其它库已经初始化过了，你同样不需要让libcurl再来一遍
libcurl有一个默认的检查机制，在调用到 `curl_easy_perform`时，判断是否调用过 `curl_global_init`。如果没有初始化，libcurl会以猜测的位模式来调用该函数。请注意这完全不建议
当程序不再使用libcurl时，需要调用 `curl_global_cleanup`，这是与初始化函数的反函数。它将执行相反的操作，清理由 curl_global_init 初始化的资源。
需要避免重复调用 `curl_global_init` 和 `curl_global_cleanup`，它们只应该被调用一次。


libcurl支持的特性
====
最好的实践，是在运行时而不是编译时去检查libcurl特性（当然仅在条件允许的情况系下）。通过调用 `curl_version_info` ，检查返回的结构体内容，程序可以明确当前运行的libcurl支持的特性。

两个接口
------
libcurl首先提供被称为easy的一组接口。所有easy接口都有前缀`curl_easy`。easy接口使你可以完成同步的阻塞式函数调用
libcurl同时还提供了另一组接口，允许在单线程中并发，这被称为multi接口。这组接口在下面有单独的章节介绍。你同样需要先理解easy接口，所以为了更好的理解，请继续顺序阅读。

使用Easy libcurl
------
要使用easy接口，你必须先创建一个handle。你需要为要执行的每一个session创建一个handle。基本上来说，需要为每一个线程单独使用一个handle。永远不应该在多线程间共享同一个handle。
通过如下方法获取一个handle：

	easyhandle= curl_easy_init();
该方法返回一个easy handle。接下来你要做的是：配置选项。一个handle仅仅是接下来一系列通信的逻辑入口。
配置handle的属性，使用 `curl_easy_setopt`。这将控制接下来的通信如何运作。选项一旦设置，就会一直保留，直到重新设置。使用同一个handle发起的多个请求，共享同一个配置。
在任何时候，想要为一个easy handle屏蔽之前的所有选项，可以通过调用`curl_easy_reset`，你也可以调用`curl_easy_duphandle`克隆一个easy handle（连同所有设置一起）。
libcurl的很多设置选项，是字符串，指向数据的指针会校验该字符串是否为空。用`curl_easy_setopt`来设置时，libcurl会自己复制一份，以便在设置之后，你的应用中不需要一直保留该变量[4]。
handle最基础的配置项是URL。如下为通信通过`CURLOPT_URL`设置URL：

	curl_easy_setopt(handle, CURLOPT_URL, "http://domain.com/");
假设你要从某一个URL获取数据。考虑的你有一系列应用需要用到该通信，假设你希望直接获取到这些数据，而不是打印到标准输出stdout，你自己写了一个匹配如下参数的函数：

	size_t write_data(void *buffer, size_t size, size_t nmemb, void *userp);
通过设置如下参数告诉libcurl将数据传给该函数：

	curl_easy_setopt(easyhandle, CURLOPT_WRITEFUNCTION, write_data);
可以通过设置如下选项，决定传给该函数的第四个参数：

	curl_easy_setopt(easyhandle, CURLOPT_WRITEDATA, &internal_struct);
设置这一属性，你可以轻松的在调用libcurl时，在应用间传递本地数据。libcurl不会修改通过`CURLOPT_WRITEDATA`传递的数据
如果没有设置`CURLOPT_WRITEFUNCTION`，libcurl又一个默认的内置回调来处理数据。它只会简单的将数据打印到标准输出stdout。你可以通过设置`CURLOPT_WRITEDATA` 为一个打开的 `FILE *` 文件，将数据写到文件中去
现在我们深呼吸，回头看看。这里有一个平台相关的瑕疵。你发现了吗？在某些平台中[2]，libcurl不能操作由程序打开的文件。因此，如果使用默认回调函数，并通过`CURLOPT_WRITEDATA`来传递打开的文件，程序将奔溃。因此为了在任何地方都可以运行程序，你需要避免这样做。
（`CURLOPT_WRITEDATA`以前也叫做`CURLOPT_FILE`，两个名字都可以正常使用，做的同样的事情）
如果你以win32 DLL动态加载库的方式使用libcurl，如果设置了`CURLOPT_WRITEDATA`，你必须设置`CURLOPT_WRITEFUNCTION`，否则会奔溃。
当然还有很多其它选项可以设置，我们一会再说。现在我们来看实际的通信：

	success = curl_easy_perform(easyhandle);
`crul_easy_perform`将会连接远端站点，执行必要的明白，并接收通信。只要接收到数据，将会调用我们之前设置的回调函数。该函数可能每次只接收到一个字节，或是一次性接收数千字节。libcurl一次尽可能多的获取数据。你的回调函数应该返回“关心的”字节数。如果这与传输给它的不等，libcurl会丢弃操作，并返回错误码。
通信结束时，该函数返回一个返回码，通知你通信成功与否。如果仅仅错误码还不够，你可以使用`CURLOPT_ERRORBUFFER`，告诉libcurl设置一个人类可阅读的错误信息。
如果你要传输另外一个文件，handle将可以重新使用。而且，比起重新开启一个新连接，我们更建议你重复使用一个已存在的handle。libcrul将会尝试重复利用之前的连接。
在某些传输协议下，下载文件，涉及到一系列复杂的登录、设置传输方式、修改当前目录，并最后传输文件。libcrul会替你完成这些负责的事务。只需要指定URL，libcurl会处理所有细节，并把文件从一台机器传输到另一台。

多线程支持
-------
除了非常少的情况，libcurl是线程安全。查看libcurl-线程获取详情。

当它不工作的时候
--------
总有一些时候由于某种原因，通信会失败。这可能是由于错误设置，或者对配置项的错误理解，也有可能是库无法处理对端返回的非标准返回值，进而影响到你的程序。
这种情况下有一个黄金处理办法：设置`CURLOPT_VERBOSE`为1。这是，库函数会返回关于发送的整个协议的细节，一些内部信息，同时还包括接收到的协议数据（特别是在使用FTP时）。如果使用HTTP，研究接收到的协议头是一个更好的方式：为什么服务器端是这样的表现。在正常返回体中包含头，将`CURLOPT_HEADER`置为1。
当然，有可能有bug。我们需要更详细的知道它们以便去修复它们。所以我们非常依赖于你的bug报告。当你报告liburl中可疑的bug时，请尽可能多的包含如下信息：由`CURLOPT_VERBOSE`打印的协议信息，库版本号、使用了libcurl的相关代码、操作系统及版本号，编译器名称及版本号等等。
如果`CURLOPT_VERBOSE`还不够，你可以在程序中通过`CURLOPT_DEBUGFUNCTION`来自定义debug数据级别。
深度学习用到的协议总是不会错的。如果你要做一些又趣的尝试，可以通过至少简短的学习合适的RFC文档，从而更加理解libcurl以及如何使用它。

向远端提交文件
------
libcurl尝试对绝大多数传输保持协议无关性。向远程FTP站点上传文件，与通过PUT请求向远程HTTP站点传输数据极其类似。
一旦我们撰写了一个应用程序，我们很有可能希望libcurl通过询问我们获取到上传数据。为了实现这一点，我们设置读回调，libcurl会将自定义指针传给读回调。读回调的协议类似：

	size_t function(char *bufptr, size_t size, size_t nitems, void *userp);
`bufptr`是一个指向一个我们填充了数据的buffer的指针，而`size *nitems`则是buffer的长度，也是在此次调用我们返回给libcurl的数据的最大长度。`userp`指针是我们在应用与回调函数间传输自定义结构体数据的指针。

	curl_easy_setopt(easyhandle, CURLOPT_READFUNCTION, read_function);
	curl_easy_setopt(easyhandle, CURLOPT_READDATA, &filedata);
告诉libcrul我们要上传什么：

	curl_easy_setopt(easyhandle, CURLOPT_UPLOAD, 1L);
少部分协议，如果没有预先设置期望的文件大小，将不能正常工作。所以，对于知道文件大小的情况下，设置`CURLOPT_INFILESIZE_LARGE`来设置上传文件大小：

	/*这个例子中，fize_size必须是 curl_off_t变量*/
	curl_easy_setopt(easyhandle, CURLOPT_INFILESIZE_LARGE, file_size);
这是你再调用`curl_easy_perform`，将会执行所有必须的操作。如果涉及到文件上传，它将会调用你提供的回调来获取上传数据。程序应该在每一次调用中尽可能多的返回数据，才可以尽可能快的完成上传。回调函数应该返回写入的buffer的字节数。返回0，意味着上传完成。

密码
=====
很多协议，在配置后，可以使用甚至要求用户名和密码才可以下载、上传数据。libcurl提供多种方式来实现。
大部分协议支持在URL中带上用户名和密码。libcurl检测到协议支持，则直接这么使用。写作如下格式：

	protocal://user:password@example.com/path/
如果在用户名和密码中存在特殊字符，需要将它们进行URL编码，如格式%XX，这里XX是2位十六进制字符。
libcurl同样支持设置密码变量。URL中嵌入的用户名和密码，同样可以通过设置`CURLOPT_USERPWD`。传给libcurl的字符串是char *类型的，形如"user:password"格式：

	curl_easy_setopt(easyhandle, CURLOPT_USERPWD, "myname:thecesret");
另一种情况，是用户名和密码需要多次使用，在需要通过proxy鉴权的情况下。libcurl提供了另一个设置项：`CURLOPT_PROXYUSERPWD`。使用起来与`CURLOPT_USERPWD`类似：

	curl_easy_setopt(easyhandle, CURLOPT_PROXYUSERPWD, "myname:thesecret");
Unix系统有一种长期标准来存储FTP的用户名密码，即$HOME/.netrc 文件中。由于文件中明文存储密码，文件应该被设置为私有的，这样才只能本人可见（见`安全`一章）。libcurl可以使用该文件，获取指定host的用户名密码。作为基本操作的扩张，liburl同样支持非FTP协议，例如HTTP。为了使curl使用该文件，设置`CURLOPT_NETRC`选项：

	curl_easy_setopt(easyhandle, CURLOPT_NETRC, 1L);
关于.netrc文件如何使用的最简单的例子如下：
	
	machine myhost.mydomain.com
	login userlogin
	password secretword
所有的示例，仅适用于密码是可选的情况，或者至少你可以不使用它，而让libcurl尝试不使用它自己完成该项工作。当密码不是可选项时，例如你为了加密传输使用SSL秘钥的情况。
将已知密码传递给libcurl：

	curl_easy_setopt(easyhandle, CURLOPT_KEYPASSWD, "keypassword");
	
HTTP鉴权
======
前面的章节展示了在访问URL需要鉴权的时候，如果设置用户名和密码。当使用HTTP协议的时候，客户端有很多不同的方法，开获取访问资格，而你可以控制liburl如何使用它们。HTTP默认的鉴权方法称为“Basic”，在HTTP请求中以base64编码的明文格式传递用户名密码，这不是安全的。
撰写本文档的时候，liburl支持4种模式：Basic, Digest, NTLM, Negotiate(SPNEGO)。你可以通过设置`CURLOPT_HTTPAUTH`来选择使用哪一种：

	curl_easy_setopt(easyhandle, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST);
当你向一个proxy代理发送鉴权，可以以同样的方式设置`CURLOPT_PROXYAUTH`:

	curl_easy_setopt(easyhandle, CURLOPT_PROXYAUTH, CURLAUTH_NTLM);
这些设置项，都允许你设置多种模式（通过OR 或），来使libcurl在server/proxy声称支持的类型中选择最安全的一种。由于libcurl必须先知道服务器支持哪种方式，该方法增加了一个轮询机制：

	curl_easy_setopt(easyhandle, CURLOPT_HTTPAUTH, CURLAUTH_DIGEST|CURLAUTO_BASIC);
为了方便使用，你可以使用`CURLAUTH_ANY`（而不是列出特定的类型），这将允许libcurl使用它想用的任何类型。
当支持多种类型时，libcurl会通过内置的顺序，选择它认为最佳的方式。

HTTP POSTing
=========
我们收到很多问题，关于如何正确使用libcurl执行HTTP POSTs。本章将包含libcurl支持的不同版本的HTTP POST的示例。
第一个版本是简单POST，最普通的版本，大部分HTTP页面使用<form>标签。我们提供了一个数据指针，来告诉libcurl发送所有数据到远端站点：

	char *data = "name=daniel&project=curl";
	curl_easy_setopt(easyhandle, CURLOPT_POSTFIELDS, data);
	curl_easy_setopt(easyhandle, CURLOPT_URL, "http://posthere.com/");
	
	curl_easy_perform(easyhandle); /* 发送post请求 */
非常简单，是吧？只要你设置了 `CURLOPT_POSTFIELDS`，将会自动将handle在未来的请求中，转为使用POST。
当然，如果你希望传输二进制数据，还是需要你设置Content-Typte：post请求头？二进制请求，阻止了libcurl使用strlen()函数来指明数据大小，所以我们必须告诉libcurl数据大小。在libcurl请求中设置请求头的一般方法，是通过构造一个请求头列表，然后将列表传给libcurl。

	struct curl_slist *headers = NULL;
	headers = curl_sliest_append(headers, "Content-Type: text/xml");
	
	/* 传递二进制数据 */
	curl_easy_setopt(easyhandle, CURLOPT_POSTFIELDS, binaryptr);
	
	/* 设置请求域的数据大小 */
	curl_easy_setopt(easyhandle, CURLOPT_POSTFIELDSIZE, 23L);
	
	/* 传递自定义的请求头列表 */
	curl_easy_setopt(easyhandle, CURLOPT_HTTPHEADER, headers);
	
	/* 发请求 */
	curl_easy_perform(easyhandle);
	
	/* 释放头列表 */
	curl_slist_free_all(headers);

以上示例覆盖了HTTP POST请求需要的主要参数，但不包括Multi-part formpost多部分表单提交。Multi-part formpost是第一次在RFC 1867（在RFC 2388中更新）中提出的，据说提交（可能大的）二进制文件一种更好的方式。命名为multi-part，是因为由一系列数据组成，各个部分是独立的数据单元。每一部分有自己的名字和内容。实际上你可以用上述的libcurl POST来提交multi-part formpost，但这需要你自己实现formpost，并提供给libcurl。为了使用方便，libcurl提供了curl_formadd。用该函数，你向一个form表单增加各个部分。加完之后，再提交整个表单。
如下示例展示了设置简单文本到文本项，再添加一个二进制文件，最后一起提交

	struct curl_httppost *post = NULL;
	struct curl_httppost *last = NULL;
	curl_formadd(&post, &last, CURLFORM_COPYNAME, "name", CURLFORM_COPYCONTENTS, "daniel", CURLFORM_END);
	curl_formadd(&post, &last, CURLFORM_COPYNAME, "project", CURLFORM_COPYCONTENTS, "curl", CURLFORM_END);
	curl_formadd(&post, &last, CURLFORM_COPYNAME, "logotype-image", CURLFORM_COPYCONTENTS, "curl.png", CURLFORM_END);
	
	/* 设置form信息 */
	curl_easy_setopt(easyhandle, CURLOPT_HTTPPOST, post);
	curl_easy_perform(easyhandel);  /*发送请求*/
	/*再次释放数据*/
	curl_formfree(post);
Multi-part formposts，使用MIME-style元数据格式的分隔符和头的一系列数据。这意味着每一部分都又一小部分设置了独立数据类型的头。来使你的应用程序更多的获取数据。libcurl允许你为这样的独立表单部分设置自定义的头。当然你可以如你所愿的设置尽可能多的小部分，本小示例展示了在一个post handle中为一个指定部分设置头部：

	struct curl_slit *headers = NULL;
	headers = curl_slist_append(headers, "Content-Type: text/xml");
	curl_formadd(&post, &last, CURLFORM_COPYNAME, "logotype-image", CURLFORM_COPYCONTENTS, "curl.png", CURLFORM_CONTENTHEADER, headers, CURLFORM_END);
	curl_easy_perform(easyhandel);  /*发送请求*/
	curl_formfree(post); /*释放数据*/
由于所有的easyhandle的操作都是“胶着”的，在你调用`curl_easy_perform`后他们仍然生效。你可能需要告诉curl接下来的请求将继续退回使用GET请求。强制一个easyhandle使用GET请求，使用`CURLOPT_HTTPGET`：

	curl_easy_setopt(easyhandle, CURLOPT_HTTPGET, 1L);
仅仅将`CURLOPT_POSTFIELDS`设置为""，或是NULL，都 不会 使得libcurl停止使用POST。仅仅是以POST方式请求而不携带任何数据。

展示过程
=======
由于历史原因，libcurl有一个可以打开的内置进度表，可以在终端上打印当前进度。
打开该进度表的方式较为奇怪，将`CURLOPT_NOPROGRESS`设置为0。该选项默认为1。
然而对于大多数应用来说，不关心内置进度表，而是关心如何进程回调的具体说明。该函数指针由你传给libcurl，然后在不确定的间隔后返回当前传输的信息。
设置进程回调通过`CURLOPT_PROGRESSFUNCTION`。所传递的回调函数的原型：

	int progress_callback(void *clientp, double dltotal, double dlnow, double ultotal, double ulnow);
	
如果任一输入参数不确定，传0即可。第一个参数`clientp`，是你通过`CURLOPT_PROGRESSDATA`传给libcurl的数据，libcurl不会动它。

C++中使用libcurl
========
在C++而不是C中使用libcurl，基本上只需要记住一件事情：
回调函数 不能 是非静态类成员函数
C++代码示例：

	class AClass {
		static size_t write_data(void *ptr, size_t size, size_t nmemb, void *ourpointer)
		{
			/*你处理数据的代码*/
		}
	}

使用代理
=======
韦氏词典中对proxy“代理”的定义：“一个人被授权代替另一个人”，也同样定义为“代理，智能，或公务副手，可以代替另外一个人”。
近日代理非常普遍。公司通常提供代理供雇员访问网络。网络客户端或用户代理使用文本访问代理，代理执行真正的请求，并返回结果。
libcurl支持SOCKS和HTTP代理。当相要访问指定URL时，libcurl将会询问代理，而不是尝试自己根据URL去访问资源。
如果你使用的是SOCKS代理，可能会发现libcurl并不支持所有的操作。
对于HTTP代理，实际上是一个普通的HTTP代理，包含了权限控制可以做什么。一个URL请求可能不是HTTP URL，也可以传递给HTTP 代理，并传回给libcurl。有时候会发生，应用可能不需要了解。我说“可能”，是因为有时候，理解使用HTTP协议的HTTP代理，非常重要。例如，你不可以哪怕是在合适的FTP目录列表中使用自定义的FTP命令。

Proxy选项
=====





























