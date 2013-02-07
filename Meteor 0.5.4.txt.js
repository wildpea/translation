Meteor 0.5.4


Meteor API
	你的Javascript代码可以同时在两个环境下运行：客户端（浏览器），服务器端（服务器上的Node.js容器）。在本API文档中，如果该函数只能在客户端，或只能在服务器端，或可以在任何地方运行，我们会指出来。


（一）Meteor Core —— Meteor 核心、

Meteor.isClient														Anywhere
	布尔值。如果当前在客户端环境中，为true。
	
Meteor.isServer														Anywhere
	布尔值。如果当前在服务器端环境中，为true。
	
Meteor.startup(func)												Anywhere
	当客户端或服务器端启动的时候，运行代码。
		参数
			func	Function
			在开始时运行的函数
	在服务器端，该函数会在服务器进程启动完成后立即运行。在客户端，该函数会在DOM就绪，.html文件中的任意<body></body>模板显示在屏幕上之后，立即运行。
		//服务器端启动时，如果数据库为空，则初始化数据
		if (Meteor.isServer) {
			Meteor.startup(function () {
				if (Rooms.find().count() == 0) {
					Rooms.insert({name: "Initial room"});
				}
			});
		}
	
Meteor.absoluteUrl([path], [options])								Anywhere
	为应用生成一个绝对URL。服务器端读取环境变量ROOT_URL来决定在那里运行。在使用meteor deploy部署apps时，自动获取。但是在使用meteor bundle时，需要提供。
		参数
			path				String
			相对root URL的路径。不要包括开始的"/"
		可选项
			secure				Boolean
			创建HTTPS URL
			replacesLocalhost	Boolean
			将localhost替换成127.0.0.1。在服务器端不任务localhost是域名的情况下会用到
			rootUrl				String
			在服务器端覆盖默认的ROOT_URL。例如："http://foo.example.com"
			
Meteor.settings														Server
	Meteor.settings包含使用meteor run或者meteor delopy命令时，使用--options时可用的所有与部署相关的选项。Meteor.settings将是你文件中定义的JSON对象。否则，Meteor.settings为空对象。
	
	
（二）Publish and subscribe - 发布和订阅
这些函数控制了Meteor服务器端如何发布记录集合，以及客户端如何订阅这些集合的。

Meteor.publish(name, func)											Server
	发布一个记录集。
		参数
			name	String
			属性集的名字。如果为null，该集合没有名字，记录将自动发送到所有连接的客户端。
			func	Function
			每次客户端订阅时，服务器端调用的函数。在该函数内部，this指向发布对象，见下面描述。如果客户端订阅时传递了参数，该函数调用时使用同样的参数。
	要发布记录到客户端，在服务器端调用Meteor.publish函数，传递两个参数：记录集的名字，以及每次客户端订阅该名字时Meteor会调用的发布函数。
	发布函数可以返回一个Collection.Cursor，如果Meteor要发布该指针指向的文档。
		//服务器：发布rooms集合，去掉密码信息
		Meteor.publish("rooms", function () {
			return Rooms.find({}, {fields: {secretInfo: 0}});
		});
		//...如果登录用户是admin，则在rooms中发布密码信息
		//如果客户端订阅了两个流，集合将合并到Rooms 集合的一个文档中
		Meteor.publish("adminSecretInfo", function () {
			return Rooms.find({admin: this.userId}, {fields: {secretInfo: 1}});
		});
	另外，发布函数可以set和unset客户端中单独的集合属性。这些函数由发布函数中的this提供。
	特别的，如果使用observe来观察数据库中的变化，确保在observe回调函数中调用this.flush。更新数据库的函数，在observe回调函数返回时，被认为完成了。
	例：
		//服务器：发布当前集合的大小
		Meteor.publish("counts-by-room", function () {
			var self = this;
			var uuid = Meteor.uuid();
			var count = 0;
			
			var handle = Messages.find({roomId: roomId}).observe({
				added: function (doc, idx) {
					count++;
					self.set("counts", uuid, {roomId: roomId, count: count});
					self.flush();
				},
				removed: function (doc, idx) {
					count--;
					self.set("couont", uuid, {roomId: roomId, count: count});
					self.flush();
				}
				//不关心移动或变化
			});
			//Observe仅在初始化added回调函数运行后返回。现标记subscription为就绪
			self.complete();
			self.flush();
			//客户端停止订阅的时候，停止观察
			self.onStop(function () {
				handle.stop();
			});
		});
		
		//客户端：声明实例化一个集合对象count
		Counts = new Meteor.Collections("counts");
		
		//客户端：自动订阅当前房间数
		Meteor.autosubscribe(function () {
			Meteor.subscribe("counts-by-room", Session.get("roomId"));
		});
		
		//客户端：使用新集合
		console.log("Corrent room has " + Counts.findOne().count + " mesages.");
	
		注意：
		如果你在调用Meteor.publish时，包含了autopublish包，Meteor将会产生一条警告。发布函数仍然会工作。
	
this.userId															Server
	在发布函数中获取。当前登录用户的id，如果用户未登录，返回null。
	这是一个常量。但如果登录用户切换了，发布函数会以新值重新运行。
	
this.set(collection, id, attributes)								Server
	在发布函数内部调用。设置属性。
		参数
			collection	String
			要设置的集合的名字
			id			String
			要设置的文档的id
			attributes	Object
			属性键值对

this.unset(collection, id, keys)									Server
	在发布函数内部调用。重置属性。
		参数
			collection	String
			要设置的集合的名字
			id			String
			要设置的文档的id
			keys		Array
			属性键数组
			
this.complete()														Server
	在发布函数内部调用。标记当前订阅已完成（初始化属性设置完成）。
	
this.flush()														Server
	在发布函数内部调用。发送所有set，unset，complete函数到客户端。
	
this.onStop(func)													Server
	在发布函数内部调用。注册一个回调函数，当订阅终止时调用。
		参数
			func	Function
			回调函数
	如果在发布句柄中调用observe，这将终止observes。
	
this.stop()															Server
	在发布函数内部调用。终止客户端订阅。
	
Meteor.subscribe(name, [, arg1, arg2, ...] [, onComplete])			Client
	订阅一个记录集。返回一个句柄，该句柄提供stop()函数，可以停止订阅。
		参数
			name				String
			订阅的名字。与服务器端发布函数中的匹配
			arg1, arg2, ...		任意类型
			传递给服务器端发布函数的可选参数
			onComplete			Function
			如果最后一个参数是函数，则将在服务器标记订阅完成时调用。无参
	当订阅一个记录集时，将通知服务器发送记录到客户端。客户端将数据存储在本地Minimongo集合中，使用与set函数中的collection参数相同的名字。Meteor会将获取到的属性存入队列中，直到在客户端用Meteor.Collection声明对应的集合名。
		//在客户端声明集合存储之前也可以订阅（可收到数据）。
		//假设"allplayers"从服务器端"players"集合中发布数据
		Meteor.subscribe("allplayers");
		//客户端将获取到的players记录存入队列中，直到...
		Players = new Meteor.Collection("players");
	如果不止一个订阅发送同一属性（相同集合名，相同文档ID，相同属性名）的值相冲突，客户端的值将会是客户端第一次发起订阅的值（即使可能不是第一个发送回客户端的值）。
	如果文档中所有属性被删除了，Meteor将会删除该文档（现在是空的了）。如果想要发布空文档，使用一个替代属性：
		clicks.insert({existes: true});
		
Meteor.autosubscribe(func)											Client
	自动建立并销毁订阅
		参数
			func	Function
			一个反应式函数，通过Meteor.subscribe函数建立订阅。当依赖发送变化时，自动重新运行。
	func会立即运行，而运行的时候，订阅的记录（通过Meteor.subscribe）和使用到的数据（调用Session.get和collection.find）将会保持。
	只要使用到的数据发生改变，订阅将会被取消，func重新运行来建立新的订阅。meteor.autosubscribe将自动停止旧的订阅。在Meteor.autosubscribenebulizer，不需要调用订阅的stop函数。
	例：
		//在当前房间内订阅消息。只要当前房间发生改变，自动更新订阅
		Meteor.autosubscribe(function () {
			Meteor.subscribe("chat", {root: Session.get("current-room")});
		});
		

（三）方法
方法，是可以在Meteor客户端中远程调用的函数。

Meteor.methods(methods)												Anywhere
	定义可被客户端通过网络调用的函数
		参数
			方法	object
			键值对，键为方法名，值为函数
	例：
		Meteor.methods({
			foo: function (arg1, arg2) {
				//.. do stuff ..
				if (you want to throw an error) {
					throw new Meteor.Error(404, "Can't find my pants");
				}
				return "some return value";
			},
			bar: function () {
				//.. do other stuff ..
				return "baz";
			}
		});
	Calling methods，在服务器端定义可被客户端调用函数。他们应该要返回值，或抛出异常。在方法调用内部，this绑定到方法调用对象，该对象提供：
		· isSimulation：布尔值，如果调用时stub，为true
		· unblock：调用的时候，允许客户端下一个方法开始运行
		· userId：当前用户的id
		· setUserId：函数，将当前客户端和一名用户联系起来
	Calling methods，在客户端定义stub函数，与服务器端方法保持一样的名字。如果不需要，可以不为methods定义stub函数。这种情况下，方法调用与其他系统中的远程调用一样，而你必须等到服务器端返回值。
	如果定义了stub函数，当客户端调用服务器端方法时，将通用会触发本身的stub函数。在客户端，stub函数的返回值被忽略。Stub函数运行是位了其边际效应：他们将会simulate服务器方法的结果，但不需要等待来回调用延迟。如果stub抛出异常，将会打印到控制台。
	你一直在使用方法，数据库基本函数（insert, update, remove）都是通过方法实现的。在客户端调用他们中的任意一个时，你将触发他们的stub版本来更新本地缓存，并发送同样的请求到服务器端。当服务器端响应时，客户端再使用真正从服务器端获取的数据更新本地缓存。
	
this.userId															Anywhere
	发起方法请求的当前用户id。如果用户未登录，则为null
	用户id是任意字符串————通常用户id都存储在数据库中。你可以通过setUserId函数来设置它。如果你在使用Meteor账户系统，then this is handled for you.
	
this.setUserId(userId)												Server
	设置登录用户
		参数
			userId		String or null
			该值应该再集合中通过userId返回
	调用该函数来在发起方法调用的连接中改变当前登录用户。它仅仅设置本连接将来调用方法时的userId值。传null注销连接。
	如果你使用内置的Meteor账户系统，它应该与Meteor.users集合中的_id属性相匹配。
	setUserId是无追溯的。它影响当前的方法调用和当前连接未来的调用。连接中任何先前的方法调用再发起时，仍然看到userId被改变了。
	
this.isSimulation													Anywhere
	在方法调用内部可获取。布尔值，如果当前调用是stub，为true。

this.unblock()													Server
	在方法调用内部调用。允许客户端随后的方法调用可在一个新的fiber中运行。
	在服务器端，某一客户端一次只能调用一个方法。第N+1个方法调用不会开始，知道第N个方法调用返回。然而，可以通过调用this.unblock来改变这个。它将允许第N+1个方法在新的fiber中运行。
	
new Meteor.Error(error, reason, details)							Anywhere
	该类标识着方法抛出的symbolic错误
		参数
			eorror	Number
			数字错误码，类似于HTTP返回码（如404，500）
			reason	String
			可选。简短的人类可阅读的错误总结，如"Not Found"
			details String
			可选。关于错误的更多信息，如堆栈跟踪信息的文字描述
	如果你希望从方法中返回一个错误，抛出异常。方法可以抛出任何类型的异常。但Meteor.Error是唯一会发送到客户端的错误。如果方法函数抛出其它类型的异常，将会发送到网络上：Meteor.Error(500, "Internal server error")。
	
Meteor.call(name, param1, param2, ... [, asyncCallback])			Anywhere
	传递任意数量的参数调用方法
		参数
			name					String
			要调用的方法名
			param1, param2, ...		JSON
			可选的方法参数
			asyncCallback			Function
			可选的回调函数。在方法完成后抛出异常或返回值后异步调用。如果未提供，可能的情况下方法同步运行（见下）。
	这是关于如何调用方法的。将在服务器端调用方法。如果有可用的stub，将同时在客户端同步执行。（同样参见Meteor.apply，它与Meteor.call一样，除了参数以数组方式传递，而非逗号间隔的参数，而你可以指定一些参数来控制方法如何执行）。
	如果在参数中的最好包含了一个回调函数（由于函数不能被序列化，它将不能传递到方法中），方法将会异步调用：它将不会返回任何特殊的值，也不会抛出异常。当方法完成的时候（可能在Meteor.call返回之前完成，也可能在之后），回调函数将会随着两个参数一起调用：error和result。如果抛出错误，error将是异常对象。否者，error将是undefined，返回的值（可能也是undefined）在result中。
		//同步调用
		Meteor.call('foo', 1, 2, function (error, result) {...});
	如果你不向服务器传递回调函数，方法调用将会被锁定，直到方法完成。最终将会返回方法的值，如果方法抛出异常则抛出异常。（如果发生远程错误，而不是Meteor.Error异常，可能是500服务器错误）。
		//同步调用
		var result = Meteor.call('foo', 1, 2);
	在客户端，如果没有传递回调函数，也没有定义stub，call将会返回undefined，而你没有途径可以获取到方法的返回值。这是因为客户端没有fibers，所以实际上也没有可能会阻塞方法的远程调用。
	最后，如果你在客户端的stub中调用另一个方法，另一个方法将不会执行（没有RPC会被触发，没有真正发生任何事情）。如果另一个方法也有一个stub，代表该方法的stub将会被执行。方法调用的返回值会是stub函数的返回值。客户端同步执行stub函数没有任何问题，这就是为什么客户端在方法内部，使用同步Meteor.call方法是可行的的原因。
	无论在客户端还是服务器端，Meteor通过方法跟踪数据库写操作，直到服务器的数据写到本地缓存中替代stub的数据之前，不会调用asyncCallback。有时，在方法返回值可用，和写操作可见之间存在延迟：例如，如果另一个方法在写入同一个文档，本地缓存不会马上更新，直到该方法完成。如果你希望服务器端返回值到达之后立刻处理，即使方法的写不可用，你可以在Meteor.apply中使用onResultReceived。
	
Meteor.apply(name, params [, options] [, asyncCallback])			Anywhere
	使用数组参数调用方法。
		参数
			name				String
			要调用的方法名
			params				Array
			方法参数
			asyncCallback		Function
			可选的回调函数；与Meteor.call中的一样
		可选参数
			wait				Boolean
			（仅用于客户端）如果为true，所有之前的方法都完成之前不会调用方法，而且在当前方法完成之前，不会调用任何其它方法。
			onResultReceived	Function
			（仅用于客户端）在服务器端返回错误或结果时（就像在asyncCallback中一样），立刻随着错误或结果调用。本地缓存可能还没有被方法结果改变。
	Meteor.apply就像Meteor.call一样，除了参数通过数组传递，而不是直接传递。你可以指定一些选项来决定客户端如何执行。
	
	
（四）服务连接
这些函数管理和检查Meteor客户端和服务器的网络连接

Meteor.status()														client
	获取当前连接状态。反应式数据源。
	该方法返回客户端和服务器端的链接状态。返回值是包含如下域的对象：
		connected		Boolean
		如果当前连接到服务器，为true。如果为false，数据改变和方法调用会被排队，直到重新建立连接。
		status			String
		当前连接状态的描述。可能的值包括connected（连接状态且正在运行），connecting（未连接，正试图建立新连接），waiting（连接失败，等待下次尝试）。
		retryCount		Number
		从连接中断以来，客户端尝试建立连接的次数。当前连接时，为0。
		retryTime		Number or undefined
		预计下次尝试建立连接的时间。要设置为直到下次连接建立为止的间隔调用，使用retryTime - (new Date()).getTime()。只有当前status为waiting时才会设置该值。
	这不是一个通知变化的回调函数，而是一个反应式数据源。你可以在模板中使用它，或作为实时更新的验证项。

Meteor.reconnect()													Client
	如果当前客户端没有连接到服务器，强制连接。如果当前已连接，该函数不做任何事情。
	
Meteor.connect(url)													Client
	连接到另一个Meteor应用，订阅其文档集，调用远程方法。
		参数
			url			String
			另一个Meteor应用的URL
	要调用另一个Meteor应用的方法，或订阅其数据集，传递参数应用的URL调用Meteor.connect。Meteor.connect返回一个对象，提供：
		· subscribe - 订阅一个记录集。参见Meteor.subscribe
		· call - 调用方法。参见Meteor.call
		· apply - 使用数组参数调用方法。参见Meteor.apply
		· methods - 定义客户端使用的远程服务的stub方法。参见Meteor.methods
		· status - 获取当前的连接状态。参见Meteor.status
		· reconnect - 参见Meteor.reconnect
		· onReconnect - 设置重新建立连接后第一个要调用的方法。该方法可在任何其他方法之前调用。例如，可用于在新连接中重新进行身份认证
	默认情况下，客户端从它们下载的地方建立与服务器的连接。当你调用Meteor.subscribe, Meteor.status, Meteor.call, 以及Meteor.apply时，你使用的与默认服务器的连接。
	
		注意：
		在本发行版本中，Meteor.connect只能在客户端调用，服务器不能与其它服务器建立连接。
	

（五）集合
Meteor将数据存储在集合中。使用时，先声明new Meteor.Collection

new Meteor.Collection(name [, options])								Anywhere
	Collection的构造函数
		参数
			name		String
			集合的名字。如果为空，将创建一个非托管（非同步）的本地集合
		options
			manager		Object
			将管理该集合的Meteor连接，如果为null默认为Meteor。非托管（name为null）的连接不能指定manager
	调用该函数，与传统以ORM（对象关系映射）为中心的框架中声明一个模型类似。它设置一个集合（数据集的存储空间，或“文档”），可用来存储特定类型的信息，如用户，内容，积分，待办事项，或任何其它与应用有关的。每一个文档是一个JSON对象，其_id属性在集合中是唯一的，你第一次生成文档时由Meteor设置
		//客户端和服务器端声明一个管理实时数据的mongo集合
		Chatrooms = new Meteor.Collection("chatrooms");
		Messages  = new Meteor.Collection("messages");
	该函数返回一个对象，包含的方法有：insert文档到集合中，update它们的属性，remove它们，还有find匹配任意标准的集合中的文档。这些方法工作的方式与流行的Mongo数据库API兼容。同样的数据库API同时可在客户端和服务器端运行（如下）
		//返回一组我的消息
		var myMessages = Messages.find({userId: Sessoin.get('myUserId')}).fetch();
		//创建一个新的消息
		Messages.insert({text: "Hello, world!"});
		//标记我的第一条消息为"important"
		Messages.update(myMessages[0].id, {$set: {import: true}});
	如果你在创建一个集合时，传递了name，你就定义了一个永久集合————存储在服务器端，所有用户可见。客户端和服务器端可以通过同样的API获取同样的集合。
	特别的，当你传递了一个name时，发生了如下事情：
		· 在服务器端，在后端Mongo服务中创建同样名字的集合。当你在服务器端在集合上调用方法时，它们直接转换为普通的Mongo运算符（在检查满足你设置的规则之后）
		· 在客户端，建立了一个Minimongo实例。Minimongo本质上来说是一个内存中的、非永久保存的用纯JavaScript实现的Mongo。像本地缓存一样工作，用来存储客户端工作的数据子集。客户端的查询（find）将直接在缓存中进行，而不需要调用服务器。
		· 当你在客户端对数据库进行写操作时（insert, update, remove），命令将立刻在客户端执行，同时，将传一份到服务器，并同样在服务器端运行。livedata包就是用来做这个事情的。
	如果给name值传为null，就创建了一个本地集合，它不与任何地方同步；仅仅是一个支持Mongo风格find, insert, update, remove操作符的暂存（在客户端和服务器端，暂存都是用Minimongo实现的）。
	默认情况下，Meteor自动向每一个连接的客户端发布集合中的所有文档。要关掉这一特性，移除autopublish包：
		$meteor remove autopublish
	调用Meteor.publish来指明集合中的哪一部分应该被发布给哪一用户。
		//创建一个名叫Posts的集合，并放入一份文档。
		//文档将在本地集合拷贝中立即可见。
		//之后，将被写入服务器端数据库中。
		//之后，将被同步到任何订阅了该集合的客户端（见Meteor.subscribe 和 autopublish）
		Posts = new Meteor.Collection("posts");
		Posts.insert({title: "Hello world", body: "First post");
		
		//变化立即可见————不需要等到下一次服务器调用
		assert(Posts.find().count == 1);
		
		//创建一个本地集合，就好像任何其它集合一样
		//但不会被传递到服务器端，也不会从订阅中获取任何数据
		Scratchpad = new Meteor.Collection;
		for (var i = 0; i < 10; i++) {
			Scratchpad.insert({number: i * 2});
		}
		assert(Scratchpad.find({number: {$lt: 9}}).count() === 5);
		
		注意：
		本发布版本中，Minimongo有一定局限：
			· $elemMath不支持选择器
			· modifiers中的$pull只能支持部分选择器
			· 选择器中，.符号可能工作不正确
			· modifiers不支持$中指明匹配数组位置
			· 不支持findAndModify，upsert，aggregate，map，reduce方法
			· 支持的类型包括String, Number, Boolean, Array, Object
		所有这些将在未来版本中修复。详细Minimongo发布记录，见本仓库的packages/minimongo/NOTES中。
		
		当前的MiniMongo没有索引。马上就有了。由于客户端通常没有那么多的数据，所以通常情况下这不是问题————无论如何开发者在其客户端模型中实现索引并不常见。
		
collection.find(selector, [options])								Anywhere
	在集合中寻找匹配selector的文档
		参数
			selector			Object: Mongo选择器，或String
			查询
		Options
			sort				Object: 排序方法说明
			排序顺序（默认：自然排序）
			skip				Number
			结果开头跳过的数量
			limit				Number
			返回结果最大数
			fields				Object: 域说明
			（仅用于服务器端）结果中要包含或不包含的项
			reactive			Boolean
			（仅用于客户端）默认为true；传false则关闭反应式
	find返回一个cursor。它并不马上访问数据库或返回文档。Cursors提供fetch方法返回所有匹配的文档，map和forEach迭代整个文档，observe注册文档发生变化时的回调函数。
		注意：
		集合cursors不是查询快照。如果在调用Collection.find和获取cursor结果或正在从cursor中获取结果期间，数据库发生变化，这些变化可能会可能不会反应在结果集中。
	Cursors是反应式数据源。你第一次在反应式上下文中通过调用fetch, map或forEach来检索cursor的文档（例如Meteor.render或Meteor.autosubscribe），Meteor将注册依赖到基本数据。在cursor中，任何对集合中文档的改变都将触发recomputation。要关闭这一特性，传递find的选项{reactive:false}
	
collection.findOne(selector, [options])								Anywhere
	返回通过sort排序和skip选择约束下匹配selector的第一个文档。
		参数
			selector		Object: Mongo选择器，或String
			查询
		Options
			sort				Object: 排序方法说明
			排序顺序（默认：自然排序）
			skip				Number
			结果开头跳过的数量
			limit				Number
			返回结果最大数
			fields				Object: 域说明
			（仅用于服务器端）结果中要包含或不包含的项
			reactive			Boolean
			（仅用于客户端）默认为true；传false则关闭反应式
	等同于find(selector, options).fetch()[0]
	
collection.insert(doc, [callback])									Anywhere
	向集合中插入一个文档，返回其唯一_id
		参数
			doc			Object
			将要插入的文档。不能已经有_id属性
			callback	Function
			可选。如果存在，调用时，第一个参数是error对象，如果没有错误，第二个参数为_id
	向集合中插入一个文档。文档仅仅是一个对象，其域可包括任意JSON兼容的数据类型集合（arrays, objects, numbers, strings, null, true, false）。
	insert将为传递的对象生成唯一ID，插入到数据库中，返回ID。
	在服务器端，如果未提供回调，insert函数将阻塞，直到数据库完成写操作，或假如有问题抛出异常。如果提供了回调，insert将立刻返回ID。一旦插入完毕（或失败），回调函数将随着错误或结果一起调用。在失败的情况下，result是undefined。如果插入成功，error是undefined，result是新文档的ID。
	在客户端，insert从不阻塞。如果未提供回调，而服务器端插入失败，Meteor将向控制台打印警告信息。如果提供了回调，Meteor将用error和result参数调用回调函数。在失败的情况下，result是undefined。如果插入成功，error是undefined，result是新文档的ID。
	例：
		var groceriesId = Lists.insert({name: "Groceries"});
		Items.insert({list: groceriesId, name: "Watercress"});
		Items.insert({list: groceriesId, name: "Persimmons"});
		
collection.update(selector, modifier, [options], [callback])		Anywhere
	改变集合中的一个或多个文档
		参数
			selector		Object: Mongo选择器，或String
			指明要改变哪一个文档
			modifier		Object: Mongo修改器
			指明如何修改文档
			callback		Function
			可选的。如果有，随着error对象一起调用
		Options
			multi			Boolean
			为true，则修改所有匹配文档。false，则修改匹配到的一个文档（默认）。
	用modifier来修改匹配到selector的文档。默认情况下，仅修改匹配到的一个文档。如果multi为true，则修改所有匹配文档。
	除了传递一个选择器，你还可以传一个字符串，将别作为_id解析。
	在服务器端，如果未提供回调，update函数将阻塞，直到数据库完成写操作，或假如有问题抛出异常。如果提供了回调函数，update将立刻返回。一旦更新完毕，回调函数将立刻被调用，如果失败，则返回error参数，成功则无参。
	在客户端，update从不阻塞。如果未提供回调，而服务器端插入失败，Meteor将向控制台打印警告信息。如果提供了回调，update将立刻返回。一旦更新完毕，回调函数将立刻被调用，如果失败，则返回error参数，成功则无参。
	例：
		//给所有积分大于10的用户“Superlative”勋章。
		//如果用户当前登录，且屏幕上显示了勋章列表，将自动更新可见
		Users.update({score: {$gt: 10}},
					 {$addToSet: {badges: "Superlative"}},
					 {multi: true});
		注意：
		Mongo upsert特性暂时未实现
	
collection.remove(selector, [callback])								Anywhere
	从集合中移除文档
		参数
			selector		Object: Mongo选择器，或String
			指明那些文档将被移除
			callback		Function
			可选。如果提供，参数中包含error对象
	从集合中删除与selector匹配的所有文档。或者可以传递一个字符串，来删除该_id对应的文档。安全考考，如果没有匹配到任何文档，什么也不做。如果选择器是{}，则删除集合中的所有文档。
	在服务器端，如果未提供回调，remove函数将阻塞，直到数据库完成写操作，或假如有问题抛出异常。如果提供了回调函数，remove将立刻返回。一旦更新完毕，回调函数将立刻被调用，如果失败，则返回error参数，成功则无参。
	在客户端，remove从不阻塞。如果未提供回调，而服务器端插入失败，Meteor将向控制台打印警告信息。如果提供了回调，remove将立刻返回。一旦更新完毕，回调函数将立刻被调用，如果失败，则返回error参数，成功则无参。
	例：
		//删除所有karma小于-2的用户
		Users.remove({karma: {$lt: -2}});
		//删除所有日志记录
		Logs.remove({});
		
collection.allow(options)											Server
	允许用户直接通过客户端代码写集合。你可以定义受限项。
		options
			insert, update, remove		Function
			检查对数据库的修改意向。如果可被允许，返回true
			fetch						String类型的数组
			可选的增强。限制为了检查update和remove函数需要从数据库获取的字段。
	客户端调用集合的insert，update或remove方法时，将会调用服务器端的allow和deny回调函数，来检查是否允许该写操作。如果有至少一个allow回调允许写操作，没有deny回调拒绝，则执行该写操作。
	这些检查，仅发生在直接从客户端写数据库操作时。例如在事件handler中调用update。服务器端代码可信任，不需要受限于allow和deny限制。这包括通过Meteor.call调用的方法————它们应该使用它们自己的检查函数，而不是依赖于allow和deny函数。
	你可以调用allow方法任意多次，每一次调用可以包括insert，update和remove函数的任意组合。如果认为操作可被执行，则返回true，否则返回false，或什么也不返回（undefined）。这种情况下，Meteor将继续搜索集合中其它allow规则。
	可能的回调函数包括：
		insert(userId, doc)
			userId的用户向集合中插入doc文档。如果操作允许，返回true。
		update(userId, docs, fields, modifier)
			userId的用户想要更新一些文档。Meteor从数据库中获取文档，并可从docs中作为数组获取。如果用户可修改这些文档，返回true。
			关于提交修改的更多细节在fields和modifier中。fields是客户端想要修改的文档最高层域，例如['name', 'score']。modifier是客户端想要执行的原始的Mongo修改器，例如{$set: {'name.first': "Alice"}, $inc: {score: 1}}
			仅支持Mongo修改器（类似$set和$push操作符）。如果用户试图替换整个文档，而不是使用$开头的修改器，请求将被直接拒绝而不检查allow函数。
		remove(userId, docs)
			userId的用户想要删除一些文档。Meteor从数据库中获取文档，并可从docs中作为数组获取。如果用户可删除这些文档，返回true。
	默认情况下，Meteor从数据库中获取文档，并赋值到docs数组中，它将返回文档中所有字段。为了更高效，你可能希望仅获取函数中真正需要的字段。可通过开启fetch选项。把fetch设置为希望获取的字段数组。
	例：
		//创建一个用户只能修改自己文档的集合。每个文档的从属关系由
		//“owner”字段来维护。所有文档只能属于创建者，且不可更改。
		//只有文档的所有者才能删除文档。防止意外删除，可设置“locked”属性
		Posts = new Meteor.Collection("posts");
		Posts.allow({
			insert: function (userId, doc) {
				//用户必须登录，且该文档属于该用户
				return (userId && doc.owner === userId);
			},
			update: function (userId, docs, fields, modifier) {
				//只能修改你自己的文档
				return _.all(docs, function (doc) {
					return doc.owner === userId;
				});
			},
			remove: function (userId, docs) {
				//只能删除你自己的文档
				retur _.all(docs, function (doc) {
					return doc.owner === userId;
				});
			},
			fetch: ['owner']
		});
		
		Posts.deny({
			update: function (userId, docs, fields, modifier) {
				//不能修改所有者
				return _.contains(fields, 'ownder');
			},
			remove: function (userId, docs) {
				//不能删除已锁定文档
				return _.any(docs, function (doc) {
					return doc.locked;
				});
			},
			fetch: ['locked']		//不需要获取“owner”
		});
	如果你从未为一个集合设置任何allow规则，所有客户端写集合操作将被拒绝，而只能通过服务器端代码写入该集合。在这种情况下，你必须为每一个允许的可能的写操作创建一个方法，然后通过Meteor.call来调用这些方法，而不是在客户端调用insert，update和remove直接操作集合。
	Meteor还有一个用来快速创建新应用的特殊的“insecure mode”（非安全模式）。在非安全模式下，如果你没有为集合设置任何allow或deny规则，那么所有用户都有对集合的全部写权限。这只是在非安全模式。如果你调用集合的allow或deny，甚至是Posts.all({})，对集合的检查就像普通模式下那样。新的Meteor项目默认情况下已非安全模式启动。使用$ meteor remove insecure来关闭它。
		注意：
		对update和remove来说，只有在获取到的文档通过sllow和deny规则，以及操作真正执行过的时候，文档才会发生变化。通过重写选择器到
		{$and: [(oringinal selector), {$in: {_id: [(ids of documents fetched and checked by allow and deny)]}}]}来实现。
	
collection.deny(options)											Server
	重写allow规则。
		options
			insert, update, remove		函数
			检查对数据库的修改意向，如果应该拒绝，返回true，即使存在一个allow规则认为可以。
			fetch						String类的Array
			可选的增强。限制为了检查update和remove函数需要从数据库获取的字段。
	与allow类似，除了这是用来让你确认某些写操作绝对被禁止的。如果没有deny规则返回true，然后再执行allow规则。Meteor只在没有deny规则返回true，并且至少有一个allow规则返回true时，才允许写操作。
	
	
（六）Cursors
	要创建一个cursor，使用find。要获取cursor中的文档，使用forEach，map或fetch。
	
cursor.forEach(callback)											Anywhere
	为每一个匹配的文档调用一次callback，顺序执行，同步。
		参数
			callback	Function
			要调用的函数
	在反应式环境中调用时，forEach注册到匹配文档的依赖。
	例：
		//打印排分头5个的标题
		var topPosts = Posts.find({}, {sort: {score: -1}, limit: 5});
		var count = 0;
		topPosts.forEach(function (post) {
			console.log("Title of post " + count + ": " + post.title);
			count += 1;
		});
		
cursor.map(callback)												Anywhere
	对整个文档调用callback，返回一个数组
		参数
			callback	Function
			要调用的函数
	在反应式环境中调用时，map注册到匹配文档的依赖。
	在服务器端，如果调用callback，在第一个调用等待时，可能会有其它对callback的调用。如果需要严格按照顺序执行，请使用forEach。
	
cursor.fetch()														Anywhere
	将匹配文档作为数组返回
	在反应式环境中调用时，fetch注册到匹配文档的依赖。
	
cursor.count()
	返回匹配查询的文档数。
		//显示匹配特定规则的内容数。并在数据库发生变化时自动更新
		var frag = Meteor.render(function () {
			var highScoring = Posts.find({score: {$gt: 10}});
			return "<p>There are " + highScoring.count() + " posts with" + "scores greater than 10</p>";
		});
		document.body.appendChild(frag);
	和其它函数不同，count注册了对匹配文档数的依赖。（对文档集的修改或重排序不会触发重新计算）

cursor.rewind()														Anywhere
	重置查询cursor
	每一个cursor中forEach，map或fetch只能调用一次。要超过一次的获取数据，使用rewind重置cursor。
	
cursor.observe(callbacks)											Anywhere
	监控一个查询。当结果集发生变化时调用callbacks
		参数
			callbacks		Object（可能包括added, changed, moved, 和removed函数）
			当结果集发生变化时调用的函数
	建立一个动态查询，当查询结果有任何变化时通知回调函数。
	callbacks可能有以下属性：
		added(document, beforeIndex)
			结果集中有了新文档。将立刻在当前beforeIndex位置前插入文档。或如果要在列表的最后插入，beforeIndex将等于（原）列表的长度。
		changed(newDocument, atIndex, oldDocument)
			旧文档的atIndex位置的文档变为newDocument
		moved(document, oldIndex,newIndex)
			结果集中的文档，从oldIndex更改为newIndex。便于使用，当前的文档为document。这会在changed之后立即调用。
		removed(oldDocument, atIndex)
			位于atIndex位置的文档oldDocument，将不再在结果集中存在。
	需要发送初始结果的话，added可立刻被调用。
	observe返回动态查询句柄，这是一个有stop方法的对象。无参调用该函数将停止调用回调函数，并关闭查询。在调用该方法之前，查询会一直进行。
	例：
		//跟踪当前多少管理员在线
		var count = 0;
		var query = Users.find({admin: true, onlineNow: true});
		var handle = query.observe({
			added: function (user) {
				count++;
				console.log(user.name + " brings the total to " + count + " admins.");
			},
			removed: function () {
				count--;
				console.log("Lost one. We're now down to " + count + " admins.");
			}
		});
		//5秒后，停止计数
		setTimeout(function () {handle.stop();}, 5000);
		
Meteor.uuid()														Anywhere
	返回一个全局唯一标识
	返回一个形如b6df7139-df0b-4daa-8c9e-b432a90bc048的可能是世界上唯一的随机字符串。字符串格式参见RFC 4122 v4格式。
		注意：
		当前Meteor使用该函数为新建Mongo文档生成_id字段。未来，我们可能会转向本地二进制Mongo IDs。那时，该函数将被复制或移动到单独的包中。
		注意：
		当前实现版本，返回的字符串，以当前时间为种子生成的伪随机数。生成的UUIDs完成不够随机，不可用于加密和安全目的。
		
Mongo风格选择器
	其最简形式，选择器仅仅是一个文档中必须匹配的键集合
		//匹配所有deleted为false的文档
		{deleted: false}
		//匹配name和cognomen与所给匹配的文档
		{name: "Rhialto", cognomen: "the marvelous"}
		//匹配所有文档
		{}
	它们也可以包含更复杂的条件：
		//匹配年龄大于18的文档
		{age: {$gt: 18}}
		//匹配tags是一个包含popular的数组的文档
		{tag: "popular"}
		//匹配水果为三个中的一个的文档
		{fruit: {$in: ["peach", "plum", "pear"]}}
	参见详细文档
	
Mongo风格的修改器
	修改器是描述如何通过修改其字段来更新文档的对象。一些例子：
		//设置文档中的“admin”属性为true
		{$set: {admin: true}}
		//为“vote”增加2，为“supporters”数组最后增加“Traz”
		{$inc: {votes: 2}, $push: {supporters: "traz"}}
	如果修改器没有包含任何$开始的操作符，将会作为文字文档解析，替换掉数据库中原本存在的任何数据（校验更新（Meteor.allow）暂时不支持文字文档）
		//找到id为123的文档，完全替换掉它
		Users.update({_id: "123"}, {name: "Alice", friends: ["Bob"]});
	插件修改器列表
	
SortSpecifiers
	可通过使用一些语法改变排序
		//所有都做同样的事：
		//sort in ascending order by key 'a', breaking ties in descending order of key "b"
		//关键字a为升序，关键字b为降序
		[["a", "asc"], ["b", "desc"]]
		["a", ["b", "desc"]]
		{a: 1, b: -1}
	最后一种情况，仅在你的JavaScript实现保有对象中的键排序。大多数情况下可以，但需要你确认。
	
Field Specifiers
	在服务器端，可为查询指定结果集中要包含或排除的字段（目前客户端忽略字段指定器）
	要从结果集中排除特定字段，字段指定器是一个对象，其键为字段，值为0
		User.find({}, {fields: {password: 0, hash: 0}})
	要返回仅包含指定字段的对象，值为1。_id字段同样包含在结果集中
		User.find({}, {fields: {firstname: 1, lastname: 1}})
	不能混合使用包含和排除。
	
（七）Sessions
	Session在客户端提供一个可以存储任意键值对的全局对象。使用它来存储数据，就好像在列表中获取项一样。
	Session特殊的是它是反应式的。如果在模板中调用Session.get("currentList")，无论何时调用Session.set("currentList", x)，模板将自动更新。
	
Session.set(key, value)												Client
	设置一个session。值改变时，触发所有监听函数（例：重绘模型，返回一个Meteor.autosubscribe模块，将在key上调用Session.get）
		参数
			key		String
			要设置的键，例：selectedItem
			value	可JSON化的对象或undefined
			key对应的新值
	例：
		Meteor.autosubscribe(function () {
			Meteor.subscribe("chat-heistory", {room: Session.get("currentRoomId")});
		});
		//导致传递给Meteor.autosubscribe的函数再次运行，chat-history订阅移动到“home”房间
		Session.set("currentRoomId", "home");
	Meteor.deps中有另一个示例
	
Session.get(key)													Client
	获取session中的值。如果在Meteor.deps上下文中，将在下次通过Session.set改变session值时，使上下文失效。本方法返回对session值的clone，所以，如果session是一个对象或数组，修改返回值不会影响到session中存储的值。
		参数
			key		String
			要返回session值的键
	例：
		Session.set("enemy", "Eastasia");
		var frag = Meteor.render(function () {
			return "<p>We've always been at war with " + Session.get("enemy" + "</p>");
		});
		//页面会说"We've always been at war with Eastasia"
		document.body.append(frag);
		
		//页面会说"We've always been at war with Eurasia"
		Session.set("enemy", "Eurasia");
		
Session.equals(key, value)											Client
	测试session值是否与某个值相等。如果在Meteor.deps上下文中，下次变量变化时上下文失效。
		参数
			key		String
			要测试的session值的键
			value	String, Number, Boolean, null, 或undefined
			被比较的值
	如果value是一个标量，下面两个表达式做同样的事：
		Session.get("key") === value
		Session.equals("key", value)
	...但通常第二种要好一些。如果触发一些invalidations(模板重绘)，使你的程序更高效。
	例：
		<template neme="postsView">
		{{! 显示一个动态更新的列表。用户点击某一项来选中。选中项赋予一个css类，可立即不同的展示。}}
		{{#each posts}}
			{{> postItem}}
		{{/each}}
		</template>
		
		<template name="postItem">
			<div class="{{postClass}}">{{title}}</div>
		</template>
		
		//在js文件中
		Template.postsView.posts = function () {
			return Posts.find();
		}
		Tempate.postItem.postClass = function () {
			return Session.equals("selectedPost", this._id) ? "selected" : "";
		}
		Template.postItem.events({
			'click': function () {
				Session.set("selectedPost", this._id);
			}
		});
		//此处使用Session.equals，意味着当用户点击某一项，改变选中值时，只有最新被选中的和最新未被选中的会发生变化
	对于对象或数组session，你不能使用Session.equals，需要使用underscore包里面的_.isEqual(Session.get(key), value);
	
（八）Accounts 账户
	Meteor账户系统，构建在publish和methods中所支持的userId之上。核心包附加用户文档，被存储在数据库中，还有附加的包支持安全密码验证、整合第三方登录服务，以及预建的用户界面。
	基本的账户系统在zccounts-base包中，但应用通常通过添加如下登录服务包自动包含该包：accounts-password, accounts-facebook, account-github, accounts-google, accounts-twitter, 或accounts-weibo。
	
Meteor.user()									除了发布函数以外的Anywhere
	获取当前用户记录集，如果用户未登录，返回null。反应式数据源。
	从Meteor.users集合中获取当前用户的记录。
	在客户端，它将作为服务器端发布的文档的一个子集返回（客户端其它字段可能不能获取到）。默认情况下，服务器端发布username, emails以及profile。用户文档中的更多字段参见Meteor.users
	
Meteor.userId()									除了发布函数以外的Anywhere
	获取当前用户id，如果用户未登录，返回null。反应式数据源。
	
Meteor.users													Anywhere
	保存用户文档的Meteor.Collection
	该集合中每个注册用户一个文档。如下是一些用户文档的例子：
		{
			_id: "bbca5d6a-2156-41c4-89da-0329e8c99a4f",  // Meteor.userId()
			username: "cool_kid_13", // unique name
			emails: [
				// each email address can only belong to one user.
				{ address: "cool@example.com", verified: true },
				{ address: "another@different.com", verified: false }
			],
			createdAt: 1349761684042,
			profile: {
				// The profile is writable by the user by default.
				name: "Joe Schmoe"
			},
			services: {
				facebook: {
					id: "709050", // facebook id
					accessToken: "AAACCgdX7G2...AbV9AZDZD"
				},
				resume: {
					loginTokens: [
						{ token: "97e8c205-c7e4-47c9-9bea-8e2ccc0694cd",
						when: 1349761684048 }
					]
				}
			}
		}
	用户文档中可以包含你希望为每个用户存储的任何数据。Meteor会对以下字段特殊处理：
		· username: 用户的唯一字符串标识。
		· email: 对象数组，包括address和verfified两个键；每个email地址最多属于一个用户。verfified是一个Boolean型，如果email地址被验证过，为true。
		· createdAt: 文档创建的时间戳（从1970年1月1日开始的毫秒数）。
		· profile: 默认情况下用户可以创建、更新任意数据的对象。
		· servides: 特殊登录服务需要用到的数据对象。例如，其reset字段为忘记密码连接的tokens，其resume字段包含在session有效期间保持登录状态的token。
	与所有Meteor.Collection一样，你可以在服务器端获取所有文档，但只有服务器端特别发布的数据才可在客户端访问到。
	默认情况下，用户的username, emails和profile户发布到客户端。要发布更多的字段，使用：
		Meteor.publish("userData", function () {
			return Meteor.users.find({_id: this.userId}, {fields: {'other': 1, 'things': 1}});
		});
	如果加载了autopublish包，所有用户的username和profile字段发布到客户端。要发布特殊的字段：
		Meteor.publish('allUserData', function () {
			return Meteor.users.find({}, {fields: {'nested.things': 1}});
		});
	默认情况下，用户可以通过Accounts.createUser定义自己的profile，并用Meteor.users.update来修改。要允许用户修改更多字段，使用Meteor.users.allow。禁止用户对其文档作任何修改：
		Meteor.users.deny({update: function () {return true;}});
	
Meteor.loggingln()													Client
	如果在登录方法中（如Meteor.loginWithPassword, Meteor.loginWithFacebook, 或Accounts.creteUser），为true。一个反应式数据源。
	例如，在处理登录请求过程中，accounts-ui包使用它来显示动画。
	
Meteor.logout([callback])											Client
	用户退出登录。
		参数
			callback		Function
			可选的回调。成功时无参调用，失败时传Error参数。
			
Meteor.loginWithPassword(user, password, [callbakc])				Client
	用户使用密码登录
		参数
			user			Object or String
			单独一个字符串将被解析为用户名或密码。或者一个对象其键为：email，username或id
			password		String
			用户密码。不在网络上通过明文传输————SRP加密
			callback		Function
			可选的回调。成功时无参调用，失败时传Error参数。

Meteor.loginWithExtenalService([options], [callback])				Client
	使用扩展服务登录。
		参数
			callback				Function
			可选的回调。成功时无参调用，失败时传Error参数。
		Options
			requestPermissons		字符串型数组
			用户请求权限列表
			requestOfflineToken		Boolean
			如果为true，离线时要用户许可对其行为的操作。在用户文档中services字段中存储一个额外的离线token。当前仅Google支持。
	这些函数初始化了使用OAuth的扩展服务登录（如Facebook，Google等）。调用的时候，打开一个弹出页面，加载服务提供商的登录页面。一旦登录成功，弹出页面关闭，Meteor客户端使用扩展服务提供的信息登录Meteor服务器。
	为了为应用确认用户，一些服务商提供API获取用户行为。要请求用户的特殊权限，传递requestPermissions选项给登录函数。这将引起在弹出窗口中展示额外的页面给用户来获取数据访问权限。用户的accessToken————许可调用服务API————存储在用户文档的services字段中。requestPermissions支持的值与其他登录服务不同，存储在各自的开发者网站中：
		· Facebook: http: //developers.facebook.com/docs/authentication/permissions/
		· GitHub: http://developer.github.com/v3/oauth/#scopes
		· Google: https://developers.google.com/accounts/docs/OAuth2Login#scopeparameter
		· Twitter, Weibo: 请求权限暂时不支持
	扩展登录服务通常要求在使用前注册并配置应用。最简单的方式是使用accounts-ui包来一步一步的指导配置。然而，数据还可以通过Accounts.loginServiceConfiguration集合手动输入。例：
		//首先，删除已有的配置项，以防服务已配置过
		Accounts.loginServiceConfiguration.remove({
			service: "weibo"
		});
		Accounts.loginServiceConfiguration.insert({
			service: "weiobo",
			clientId: "1292962797",
			secret: "75a730b58f5691de5522789070c319bc"
		});
	每一个扩展服务都有自己的登录包和登录函数。如：支持GitHub登录，运行$ meteor add accounts-gitbub，调用Meteor.loginWithGithub函数：
		Meteor.loginWithGitHub({
			requestPermissions: ['user', 'public_repo']
		}, function (err) {
			if (err)
				Session.get('errorMessage', err.reason || 'Unknown error');
		});
	
{{currentUser}}										Handlebars templates
	调用Meteor.user()。使用{{#if currentUser}}检查当前用户是否登录
	
{{loggingln}}										Handlebars templates
	调用Meteor.loggingln().
	
Accounts.config(options)										Anywhere
	设置全局账户选项
		Options
			sendVerification				Boolean
			使用email的新用户将收到一封确认邮件。
			forbidClientAccountCreation		Boolean
			客户端调用createUser将被拒绝。更多的，如果在使用accounts-ui，“Create account”链接也不可用。
		
Accounts.ui.config(options)											Client
	配置{{loginButtons}}的行为
		Options
			requestPermissions		Object
			允许每一个扩展服务的请求
			requestOfflineToken		Object
			要求用户在离线时允许对其行为的操作。相应的扩展服务为true。当前你只能支持Google。更多细节参见Meteor.loginWithEcternalService.
			passwordSignupFields	String
			在用户注册表单中显示哪些字段。'USERNAME_AND_EMAIL', 'USERNAME_AND_OPTIONAL_EMAIL', 'USERNAME_ONLY', 'EMAIL_ONLY'（默认）中的一个。
	例：
		Accounts.ui.config({
			requestPermissions: {
				fasebook: ['user_likes'],
				github: ['user', 'repo']
			},
			requestOfflineToken: {
				google: true
			},
			passwordSignupFields: 'USERNAME_AND_OPTIONAL_EMAIL'
		});
		
Accounts.validateNewUser(func)										Server
	设置创建新用户的限制
		参数
			func		Function
			新用户创建时调用。传入新用户对象，如果允许创建返回true，否则返回false。
	可被重复调用。如果任何函数返回false，或抛出异常，新用户创建失败。要设置错误信息（将会通过accounts-ui显示），抛出Meteor.Error.
	例：
		//验证用户名，在失败时发送错误信息
		Accounts.validateNewUser(function (user) {
			if (user.username && user.username.length >= 3) {
				return true;
			}
			throw new Meteor.Error(403, 'Username must have at least 3 characters');
		});
		//验证用户名，不抛出错误信息
		Accounts.validateNewUser(function (user) {
			return user.username !== 'root';
		});
		
Accounts.onCreateUser(func)											Server
	自定义创建用户。
		参数
			func		Function
			新用户创建时调用。返回新的用户对象，或者创建失败时抛出Error
	当你需要不仅仅是同意或拒绝创建新用户时，使用该函数。你可以从程序上控制新用户文档内容。
	传递的函数将会用两个参数来调用：options和user。options参数来自基于密码的用户的Accounts.createUser，或扩展登录服务数据。options可能来自不可信的客户端，所以你需要检查读取到的每一个值。user参数在服务器端创建，包含自动生成的用户登录所需字段的期望的用户对象。
	该函数应该随着不管何种期望的修改返回用户文档（不管是传入的还是新建的对象）。返回的文档将直接插入到Meteor.users集合中。
	默认的创建用户函数只是简单的复制了一份options.profile到新用户文档中。调用onCreateUser重写默认钩子。只能调用一次
	例：
		//支持玩D&D:Roll 3d6 for dexterity
		Accounts.onCreateUser(function (options, user) {
			var d6 = function () { return Math.floor(Math.randorm() * 6) + 1; };
			user.dexterity = d6() + d6() + d6();
			//我们仍然希望使用默认钩子的‘profile’行为
			if (options.profile) {
				user.profile = options.profile;
			}
			return user;
		});
		
（九）密码
	account-password包包含了密码认证的全部系统。除了基本的用户名和密码注册过程，还支持email注册，包括地址确认和密码找回。
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	
	