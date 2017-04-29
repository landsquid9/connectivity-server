/* This Script handles the Aether IOT app.*/

/* --- IMPORTS --- */

import React from './../../../node_modules/react'; // We are using React
import ReactDOM from 'react-dom';

var MessageHandler = require("./message-handler.js"	);
var url	= require("../../shared-scripts/shared-data.js");

/* --- END IMPORTS --- */



/* --- REACT --- */

/* 	All HTML on the page will be generated by React in this JS file.
 	There is a single ("root") Dom element in the HTML shell file, which
	everything will	be attached to. The top level component in this file is the
	"App" class below. Classes are a recent JS addition. The "render function"
	describes the HTML and makes use of sub components, which you can find
	after the class definition. The "state" of the class holds properties
	that when changed wil trigger an update in the render function. I have
	made the websocket object a property of the app class so that when its
	"onmessage" event is triggered I can update the state and so update the
	display. */
class App extends React.Component // Acces React by inheritance
{
	/* Constructor. Props will hold any values passed to "App" */
	constructor(props)
	{
		/* Necessary to call superclass ctor */
		super(props);
		/* Define state variables, and initial values */
		this.state = 	{
							showChooseConnection : false,
							chooseConnectionList : [],
							senders : [],  		// List of sender objects
							receivers : [], 	// List of receiver objects
							selectedDevice : {
												name: "",
												mode: "",
												dataType: "",
												connections: []} // Selected Device
						};

		/* Bind the function that is called when data is received from
		   websocket, so this works correctly. */
		this.handleWebSocketData 	= this.handleWebSocketData.bind(this);
		/* and when device is clicked */
		this.handleSelectDevice 	= this.handleSelectDevice.bind(this);
		this.handleChooseConnection = this.handleChooseConnection.bind(this);
		this.handleClickChooseConnection = this.handleClickChooseConnection.bind(this);
		self = this;

		/* Create a websocket. this will be used to receive data
		   from the website */
		this.ws = new WebSocket(url);

		/* Create an object to store client details. Upon connection this
		   will be sent to the server to register this app as a controller  */
		this.clientConfig =
		{
			messageType     : "config",
			messageContent  :
			{
				device      : "nodeMCU",
				name        : "netControl",
				mode        : "controller",
				dataType    : ""
			}
		};

		/* Create an object to store new connection details.
		 * This will be used to send a message to the server when the user sets up
		 * a new connection between different devices
		 */
		this.newConn =
		{
			messageType    : "new connection",
			messageContent :
			{
				receiver : "",
				sender   : "",
				remove   : false
			}
		};

		/* Create an object to store disconnect details
		 * This will be used to send a message to the server when the user manually
		 * disconnects a client by pressing the appropriate button.
		 */
		this.disconnect =
		{
			messageType    : "disconnection",
			messageContent :
			{
				name : ""
			}
		};

		/* This utility object processes received messages and stores
		   the processed data */
		this.messageHandler = new MessageHandler();

		/* Set up the Websocket */
		/* When connection is established */
		this.ws.onopen = function()
		{

			console.log('Connected to ' + url);
			/* Convert client config details to JSON and then
			 * send */
			var clientConfigMsg = JSON.stringify(self.clientConfig);
			self.ws.send(clientConfigMsg)
		};

		/* Upon receiving a message */
		this.ws.onmessage = this.handleWebSocketData;

	}

	/* This function runs when a message is received from the server.
	   this message will contain a new list of devices, which are used to
	   update the React HTML, by setting the state */
	handleWebSocketData(data, mask)
	{
		console.log(data.data);
		var substr = data.data.substring(0, 6);
		console.log(substr);
		if(data.data == '_ping')
		{
			console.log("ping recv");
			self.ws.send(data.data);
		}
		else
		{
			/* Process the message */
			if(this.messageHandler.processMessage(data.data))
			{
				/* Get lists of senders and receivers */
				this.setState({	senders: 	this.messageHandler.getSenders(),
								receivers: 	this.messageHandler.getReceivers()});

				var name = this.state.selectedDevice.name;
				var tmp = this.state.senders.find(obj => obj.name == name);

				if(tmp != undefined)
				{
					this.setState({selectedDevice : tmp,
									chooseConnectionList : this.state.receivers});
				}
				else
				{
					tmp = this.state.receivers.find(obj => obj.name == name);

					if(tmp != undefined)
					{
						this.setState({selectedDevice : tmp,
										chooseConnectionList : this.state.senders});
					}
					else
					{
						this.setState(	{
											selectedDevice :
											{
												name: "",
												mode: "",
												dataType: "",
												connections: []} // Selected Device
										})
					}
				}


			}
			else
			{
				console.error("There was an error processing the message");
			}
		}

	}

	/* This function executes when the user clicks a device. We need to show
	 * information about that device in the details panel. */
	handleSelectDevice(deviceName)
	{
		/* We receive the name of a device. Check it against
		 * all the devices in our lists to  see which one it is */
		var selDev = this.state.senders.find(obj => obj.name== deviceName);

		if(selDev != undefined)
		{
			console.log("Selected Device is sender");
			this.setState({selectedDevice: selDev,
							chooseConnectionList: this.state.receivers})
			return true;
		}
		else
		{
			selDev = this.state.receivers.find(obj => obj.name == deviceName);

			if(selDev != undefined)
			{
				console.log("Selected Device is receiver");
				this.setState({selectedDevice: selDev,
								chooseConnectionList: this.state.senders});
				return true;
			}
		}

		console.error("Could not find device");
		return false;

	}

	handleChooseConnection(dev1, dev2, remove)
	{
		console.log("Choosing connection");
		console.log("Dev1: " + dev1);
		console.log("Dev2: " + dev2);
		/* first work out which is sender and which is receiver */
		/* if dev1 is a sender */
		if(this.state.senders.find(obj => obj.name == dev1) != undefined)
		{

			console.log("dev1 is sender");
			this.newConn.messageContent.receiver = dev2;
			this.newConn.messageContent.sender = dev1;
		}
		/* other wise */
		else
		{
			console.log("dev1 is receiver");
			this.newConn.messageContent.receiver = dev1;
			this.newConn.messageContent.sender = dev2;
		}

		this.newConn.messageContent.remove = remove;
		this.ws.send(JSON.stringify(this.newConn));
	}

	handleClickChooseConnection()
	{
		var newVal = !this.state.showChooseConnection;
			this.setState({showChooseConnection: newVal});


	}

	/* The HTML. */
	render()
	{
		return  <div className = "page">

							<MainMenu />

					<div className="row">
						<div className ="col-xs-12">
							<div className = "panel-main">
								<div className = "header">
									<div className = "row">
										<div className="col-xs-12">

											<div className ="pane">
												<h1> The Aether Web App </h1>
											</div>

									</div>
									</div>

											<div className ="row">
												<div className="col-xs-9">

														<div className="pane">
															<p>
															Below is a list of devices currently connected to Aether
															and information on the currently selected device. Under
															tests you can find web based versions of devices.
															</p>
														</div>
													<div className = "border-container">
														<div className = "row">

															<MainDeviceList senders = {this.state.senders}
																		receivers = {this.state.receivers}
																		onSelectDevice = {this.handleSelectDevice}/>


															<Details selectedDevice = {this.state.selectedDevice}
																	 chooseConnDevices = {this.state.chooseConnectionList}
																		onChooseConnection = {this.handleChooseConnection}
																			showChooseConnection = {this.state.showChooseConnection}
																			onClickChooseConnection = {this.handleClickChooseConnection}/>

															</div>
													</div>
												</div>
												<div className="col-xs-3">
													<Tests/>
												</div>
											</div>

										</div>

							</div>
						</div>
					</div>
				</div>;
	}
};

/* -- COMPONENTS -- */

/* This component is the main menu on the side */
function MainMenu(props)
{
	return 	<div className = "main-menu">
				<div className="row">
					<MenuItem link="../index.html" newPage="_self" text="Home" />
					<MenuItem link="http://connectivity.art.blog" newPage="_blank" text="Blog" />
					<MenuItem link="../contact/index.html" newPage="_self" text="Contact" />
					<MenuAppItem link="../aether-web-app/index.html" newPage="_self" text="App" />

				</div>
			</div>;
};

/* This component is a menu item in the main menu (see above).
   It takes a hyper link and displayed text as properties */
function MenuItem(props)
{
	return	<div className="col-md-2 col-xs-4">
			<div className = "menu-item">
				<a href={props.link} target={props.newPage} className="button"> {props.text} </a>
			</div>
			</div>;

};

/* This component is a menu item in the main menu (see above).
   It takes a hyper link and displayed text as properties */
function MenuAppItem(props)
{
	return	<div className="col-xs-12 col-md-6">
			<div className = "menu-item-app">
				<a href={props.link} target={props.newPage} className="button"> {props.text} </a>
			</div>
			</div>;

};

/* This component is the list of connected devices. Provide
 	a list of sender objects and receiver objects */
function MainDeviceList(props)
{
	return 	<div className = "col-xs-3">
				<div className="pane">

							<h2>DEVICES</h2>


						<h3> Senders </h3>
						{props.senders.length == 0 &&
						<p> There are no devices in sender mode connected to Aether currently </p>}
						<SubDeviceList 	devices = {props.senders}
										onSelectDevice = {props.onSelectDevice}/>
						<h3> Receivers </h3>
						{props.receivers.length == 0 &&
						<p> There are no devices in receiver mode connected to Aether currently </p>}
						<SubDeviceList 	devices = {props.receivers}
										onSelectDevice = {props.onSelectDevice}/>

				</div>
		   	</div>
}

/* Device List s split into sender list and receiver list */
function SubDeviceList(props)
{
	const arr = [];
	for(var i of props.devices)
	{
		arr.push(i.name);
	}
	const elements = arr.map((el) =>
		<DeviceListItem key = {el}
						text = {el}
						onSelectDevice = {props.onSelectDevice}/>);

	return  <div className = "sub-device-list">
				{elements}
			</div>;
}

/* This an item within the device list */
class DeviceListItem extends React.Component
{
	constructor(props)
	{
		super(props);
		this.state = {deviceName: props.text};
		this.onSelectDevice = props.onSelectDevice;
		this.handleSelectDevice = this.handleSelectDevice.bind(this);
	}

	/* This will be set to run in the onclick event. It, in turn, calls
	 * the function that was passed as a prop
	 */
	handleSelectDevice()
	{
		this.onSelectDevice(this.state.deviceName);
	}

	render()
	{
		return  <div className = "button" onClick = {this.handleSelectDevice}>
					{this.state.deviceName}
				</div>

	}


}

function Details(props)
{
	var det;
	if(props.selectedDevice.name == "")
	{
		det = <p> There is currently no device selected. If there are devices
			currently connected to Aether, click one on the list to the left.
			It's details will show up here. </p>
	}
	else
	{
		det = <div className = "row">

			<div className = "col-xs-6">
				<Information 	selectedDevice 	 = {props.selectedDevice}
								devices = {props.chooseConnDevices}
								onChooseConnection = {props.onChooseConnection}
								onClickChooseConnection = {props.onClickChooseConnection}
								showChooseConnection = {props.showChooseConnection}/>
			</div>
			<div className = "col-xs-6">
				<Connections connectionList = {props.selectedDevice.connections}/>
			</div>
		</div>
	}
	return 	<div className = "col-xs-9">
				<div className ="pane">
						<h2> DEVICE DETAILS </h2>
						{det}
				</div>
			</div>
}

function Information(props)
{

	return	<div className = "panel-information">
			{props.showChooseConnection &&
				<ChooseConnection 	devices={props.devices}
									deviceInFocus={props.selectedDevice.name}
									onSelectDevice={props.onChooseConnection}
									closeChooseConnection={props.onClickChooseConnection}/>}

				<table>
					<tbody>
					<tr>
						<td className="cell">
							<h3>
								Name
							</h3>
						</td>
						<td className="cell">
							<h3> {" : "}  </h3>
						</td>
						<td className="cell">
							<h3>
								{props.selectedDevice.name}
							</h3>
						</td>
					</tr>
					<tr>
						<td className="cell">
							<h3>
								Mode
							</h3>
						</td>
						<td className="cell">
							<h3> {" : "} </h3>
						</td>
						<td className="cell">
							<h3>
								{props.selectedDevice.mode}
							</h3>
						</td>

					</tr>
					<tr>
						<td className="cell">
							<h3>
								Data Type
							</h3>
						</td>
						<td className="cell">
							<h3> {" : "}  </h3>
						</td>
						<td className="cell">
							<h3>
								{props.selectedDevice.dataType}
							</h3>
						</td>
					</tr>
				</tbody>
				</table>
				<button className="button" onClick={props.onClickChooseConnection}>
					Setup a connection with another device
				</button>

			</div>

}

/* Give a list of senders or receivers as connections.
 */
function ChooseConnection(props)
{
	return  <div className = "fade-background" onClick={props.closeChooseConnection}>
				<div className = "choose-connection-list">
					<h3> Choose a device to connect to below </h3>
					<ChooseConnectionList 	devices = {props.devices}
									deviceInFocus = {props.deviceInFocus}
									onSelectDevice = {props.onSelectDevice} />
				</div>
			</div>
}

/* Device List s split into sender list and receiver list */
function ChooseConnectionList(props)
{
	const arr = [];
	for(var i of props.devices)
	{
		arr.push(i.name);
	}
	const elements = arr.map((el) =>
		<ChooseConnectionItem key = {el}
						deviceToSelect = {el}
						deviceInFocus = {props.deviceInFocus}
						onSelectDevice = {props.onSelectDevice}/>);

	return  <div className = "sub-device-list">
				{elements}
			</div>;
}

/* This an item within the device list */
class ChooseConnectionItem extends React.Component
{
	constructor(props)
	{
		super(props);
		this.state = {deviceToSelect: props.deviceToSelect,
						deviceInFocus: props.deviceInFocus};
		this.onSelectDevice = props.onSelectDevice;
		this.handleSelectDevice = this.handleSelectDevice.bind(this);
	}

	/* This will be set to run in the onclick event. It, in turn, calls
	 * the function that was passed as a prop
	 */
	handleSelectDevice()
	{
		this.onSelectDevice(this.state.deviceInFocus, this.state.deviceToSelect, false);
	}

	render()
	{
		return  <div className = "button" onClick = {this.handleSelectDevice}>
					{this.state.deviceToSelect}
				</div>
	}


}

function Connections(props)
{
	const arr = [];
	for(var i of props.connectionList)
	{
		arr.push(i.name);
	}
	const elements = arr.map((el) =>
		<ConnectionsItem key = {el}
						text = {el}/>);
	return	<div className="connections">
				The Selected Devices Current Connections
				<ul>
					{elements}
				</ul>
			</div>;
}

function ConnectionsItem(props)
{
	return	<li className = "connections-item">
				{props.text}
			</li>
}

function Header(props)
{
	return 	<div className = "header">
		<div className = "row">
			<div className="col-xs-12">
			<div className ="shell">
				<div className ="title">
					The Aether Web App
				</div>
			</div>
		</div>
		</div>

				<div className ="row">
					<div className="col-xs-8">
						<div className="shell">
							<div className="description">
								Below is a list of devices currently connected to Aether
								and information on the currently selected device. Under
								tests you can find web based versions of devices.
							</div>
						</div>
					</div>
					<div className="col-xs-4">
						<Tests/>
					</div>
				</div>

			</div>
}

function Tests(props)
{
	return 	<div className = "pane">
				<h3> Test Devices </h3>
				<ul>

					<li>
						<TestItem link="../mcusim-button/index.html" name="button" />
					</li>
					<li>
						<TestItem link="../mcusim-led/index.html" name="led" />
					</li>
				</ul>

		</div>
}

function TestItem(props)
{
	return <a href={props.link} target="_blank" className="button"> {props.name} </a>

}



ReactDOM.render(
  <App />,
  document.getElementById('root')
);

/* --- END REACT --- */
