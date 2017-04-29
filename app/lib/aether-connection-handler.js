/* This object stores Aether connections and handles their interactions.
   Error messages are prefixed with [ACH] */

module.exports = exports = function AetherConnections()
{
	/* To maintain a reference to this object. The this keyword changes meaning
	 * when passed to a callback function
	 */
	myself = this;

	/*----- OBJECT PROPERTIES -----*/
	/* A list of senders, receivers and controllers */
	this.senders     = [];
	this.receivers   = [];
	this.controllers = [];
	/* Valid Data Types */
	this.validDataTypes = ["pulse", "text", "number", "boolean"]

	/* Ping data. */
	/* Populated when a ping is sent. Depopuated when it receives
	 	a response. Anything in the array has not responded, and so after a
		set amount of time can be removed from the system. */
	this.pingedConnections = [];

	/*----- OBJECT METHODS -----*/

	/*----- Public -----*/

	/* Description: Processes a received message.
	   Arguments:   A Received Message, and the socket it came from.
	   Returns:     Nothing
     */
	this.processMessage = function(msg, socket)
	{
		console.log(msg);
		if(msg == "_ping")
		{
			console.log("Received Ping from: ");
			/* Now remove from the ping list, because it has responded */
			var indexToRemove = this.pingedConnections.findIndex(s => s == socket);
			console.log("pingedConnections index: ");
			console.log(indexToRemove);
			this.pingedConnections.splice(indexToRemove, 1);
		}
		else
		{
			/* try parsing the message */
			var parsedMessage = this.parseMessage(msg);

			/* Parsed correctly? */
			if(parsedMessage)
			{
				/* If it is a configuration message */
				if(parsedMessage.messageType == "config")
				{
					this.configureClient(parsedMessage, socket);
					this.updateControllers();
				}
				/* if it is a new connection between a sender and a receiver */
				else if(parsedMessage.messageType == "new connection")
				{
					this.updateConnections(parsedMessage.messageContent.receiver,
										   parsedMessage.messageContent.sender,
										   parsedMessage.messageContent.remove);
					this.updateControllers();
				}
				else if(parsedMessage.messageType == "disconnection")
				{
					this.disconnect(parsedMessage.messageContent.name);
				}
				else
				{
					/* Unrecognised message type */
					console.error("[ACH] Unrecognised message format");
				}
			}
			else
			{
				console.error("[ACH] Message not parsed");
			}
		}

	}
	/* Description: When the connection is closed, update everything.
	   Arguments:   The socket that was closed
	   Returns:     Nothing
     */
	this.closeConnection = function(socket)
	{
		/* Search senders */
		var indexToRemove1 = this.senders.findIndex(obj => obj.clientSocket == socket);

		if(indexToRemove1 != -1) // If index found in senders
		{
			/* Go through its connections*/
			for(var i of this.senders[indexToRemove1].clientConnections)
			{
				var nameToFind = i.name;
				/* Get Object from recv list */
				var ob = this.receivers.find(obj => obj.clientName == nameToFind);
				/* Find match */
				indexToRemove2 = ob.clientConnections.findIndex(obj => obj.clientName == this.senders[indexToRemove1].clientName);
				/* Remove from its connections */
				ob.clientConnections.splice(indexToRemove2, 1);
			}
			/* Remove client */
			this.senders.splice(indexToRemove1, 1);
			/* Update the controllers */
			this.updateControllers();
			return true;
		}

		/* If we didn't return, search receivers */
		indexToRemove1 = this.receivers.findIndex(obj => obj.clientSocket == socket);

		if(indexToRemove1 != -1) // If index found in receivers
		{
			/* Go through its connections*/
			for(var i of this.receivers[indexToRemove1].clientConnections)
			{
				var nameToFind = i.name;
				/* Get Object from recv list */
				var ob = this.senders.find(obj => obj.clientName == nameToFind);
				/* Find match */
				indexToRemove2 = ob.clientConnections.findIndex(obj => obj.clientName == this.receivers[indexToRemove1].clientName);
				/* Remove from its connections */
				ob.clientConnections.splice(indexToRemove2, 1);
			}
			/* Remove client */
			this.receivers.splice(indexToRemove1, 1);
			/* Update the controllers */
			this.updateControllers();
			return true;
		}

		/* If we still havent returned, seach controllers */
		indexToRemove1 = this.controllers.findIndex(i => i.clientSocket == socket);

		if(indexToRemove1 != -1)
		{
			this.controllers.splice(indexToRemove1, 1);
			return true;
		}
		else
		{
			console.error("The socket was not found when trying to remove the client")
			return false;
		}



	}

	/*----- Private -----*/

	/* Description: Provide the function with a recieved message. It will
	                attempt to convert into a JSON.
	   Arguments:   A Received Message.
	   Returns:     A Parsed message as javascript object, or NULL if parsing
	                failed
     */
	this.parseMessage = function(msg)
	{
		var parsed = null;
		/* Try to parse the message into a JS object. If this
		 * fails it means the message was not JSON */
		try
		{
			parsed = JSON.parse(msg);
		}
		catch(err)
		{
			console.error("[ACH] JSON parsing failed: ")
			console.error(err);
			return null;
		}

		/* Check it has the correct properties. Note: further
		 * checks will have to be made based on the specific
		 * message type.
		 */
		if(parsed.hasOwnProperty("messageType"))
		{

			if(parsed.hasOwnProperty("messageContent"))
			{

				if(typeof(parsed.messageContent == "object"))
				{

					/* Success */
					return parsed;
				}
			}
		}

		/* Not valid */
		console.error("[ACH] Message has incorrect properties");
		return null;
	}

	/* Description: Configures the client with the message provided
	   Arguments:   A configure message
	   Returns:     true if successful, false otherwise
     */
	this.configureClient = function(msg, socket)
	{
		/* Check for name and mode properties */
		if(msg.messageContent.hasOwnProperty("name") &&
			msg.messageContent.hasOwnProperty("mode"))
		{

			/* Check for name uniqueness */
			var uniqueName = this.checkName(msg.messageContent.name);

			/* Send? */
			if(msg.messageContent.mode == "send")
			{
				/* Check validity of data type */
				if(msg.messageContent.hasOwnProperty("dataType"))
				{
					/* Look for match with valid types */
					for(var i of this.validDataTypes)
					{
						/* if match */
						if(msg.messageContent.dataType == i)
						{
							/* add to the array */
							this.senders.push(
							{
								clientName      : uniqueName,
								clientMode		: msg.messageContent.mode,
								clientDataType	: msg.messageContent.dataType,
								clientSocket    : socket,
								clientReading   : "",
								clientConnections : []
							});

							/* Because the client is now registered, we can give the socket
							 * a new onMessage function. We are only listening for new data,
							 * and for efficiency's sake are not checking it is of the right
							 * type.
							 */
							function senderFunction(data, flags)
							{
								/* Look for this socket in senders */
								for(var c of myself.senders)
								{
									if(c.clientSocket == socket)
									{
										/* check if ping */
										if(data == "_ping")
										{
											myself.handlePing(c.clientName);
										}
										else
										{
											/* otherwise send data onto recievers */
											for(var r of c.clientConnections)
											{
												r.socket.send(data);
											}
										}
									}
								}

							}
							socket.removeAllListeners();
							socket.on('message', senderFunction);
							socket.on('close', function(){myself.closeConnection(socket)});
							/*Success!*/
							return true;
							// break;
						} // END DATA TYPE MATCH IF
					}// END DATA MATCH FOR

					console.error("[ACH] Invalid data type");
					return false;
				} // END DATA TYPE VAR CHECK IF
				else
				{
					console.error("[ACH] No Data Type set")
					return false;
				}
			}
			/* Or receive? */
			else if (msg.messageContent.mode == "receive")
			{
				/* Check validity of data type */
				if(msg.messageContent.hasOwnProperty("dataType"))
				{
					/* Look for match with valid types */
					for(var i of this.validDataTypes)
					{
						/* if match */
						if(msg.messageContent.dataType == i)
						{

							this.receivers.push(
							{
								clientName   	: uniqueName,
								clientMode		: msg.messageContent.mode,
								clientDataType	: msg.messageContent.dataType,
								clientSocket 	: socket,
								clientConnections	: []

							});
							/* Because the client is now registered, we can give the socket
							 * a new onMessage function. (Nothing in it for now, because
							 * there are no messages we need to process from receivers)
							 */
							 function receiverFunction(data, flags)
 							{
								/* Look for this socket in senders */
								for(var c of myself.receivers)
								{
									if(c.clientSocket == socket)
									{
										/* check if ping */
										if(data == "_ping")
										{
											myself.handlePing(c.clientName);
										}
									}
								}

 							}
							 socket.removeAllListeners();
							socket.on('message', receiverFunction);
							socket.on('close', function(){myself.closeConnection(socket)});

							/* Success!*/
							return true;
							// break;
						} // END DATA TYPE MATCH
					}

					console.error("[ACH] Invalid data type");
					return false;
				} // END DATA TYPE VAR CHECK IF
				else
				{
					console.error("[ACH] No Data Type set")
					return false;
				}
			}
			/* Or controller? */
			else if (msg.messageContent.mode == "controller")
			{

				this.controllers.push(
				{
					clientName   : uniqueName,
					clientSocket : socket
				});
				/* Success!*/
				return true;
			}
			/* Or unrecognised ? */
			else
			{
				console.error("[ACH] Unrecognised type in config message");
			}
		}

		/* If we haven't returned true yet, then the message
		 * object wasn't correctly formatted. Return false
		 */
		 console.error("[ACH] Unable to configure client");
		return false;
	}

	/* Description: Checks the name to see if it is unique
	   Arguments:   A name
	   Returns:     The orginal name, or if it wasn't unique, a new unique name
     */
	this.checkName = function(name)
	{
		/* Haven't decided on uniqness yet */
		var nameDecided = false;
		/* If not unique, name is made unique by appending numbers */
		var suffix = 0;
		/* If no name is provided give it a default*/
		var newName;
		if(name == "")
		{
			newName = "1";
		}
		else
		{
			newName = name;
		}

		while(!nameDecided)
		{
			var unique = true;

			/* Check senders */
			for(var i in this.senders)
			{

				if(this.senders[i].clientName == newName)
				{
					unique = false;
					newName = name + suffix;
					break;
				}
			}
			// and receivers
			for(var i in this.receivers)
			{
				/* If name already exists, indicate so */
				if(this.receivers[i].clientName == newName)
				{
					unique = false;
					newName = name + suffix;
					break;
				}
			}

			/* get a new suffix */
			suffix ++;

			if(unique)
			{
				nameDecided = true;
			}
		}
		/* Success!*/
		return newName;
	}

	/* Description: Updates the connections to connect receiver "r" with sender
					"s"
	   Arguments:   The name of a receiver and the name of a sender, and
	   				a boolean that if true, removes the connection rather
					than setting it up
	   Returns:     True if successful, false otherwise
     */
	this.updateConnections = function(r, s, remove)
	{
		/* Check args */
		if(typeof(r) != "string" ||
		   typeof(s) != "string" ||
		   typeof(remove) != "boolean")
		{
			console.error("[ACH] Wrong types supplied to updateConnections");
			return false;
		}

		var alreadyExists = false;

		/* Check if the connection already exists */
		/* loop through senders */
		for(i of this.senders)
		{
			/* If match */
			if(i.clientName == s)
			{
				/* Loop through connections of match */
				if(i.clientConnections.length > 0)
				{
					for(j of i.clientConnections)
					{
						/* If match */
						if(j.name == r)
						{
							/* Connections lready exists */
							alreadyExists = true;
						}
					}
				}
			}
		}

		/* If the Connection already exists, and remove is true */
		if(alreadyExists && remove)
		{
			/* Remove the Connection */
			/* From Senders */
			for(i of this.senders)
			{
				if(i.clientName == s)
				{
					for(j of i.clientConnections)
					{
						if(j.name == r)
						{
							i.clientConnections.splice(indexOf(j), 1)
							break;
						}
					}
				}
			}

			/* From Receivers */
			for(i of this.receivers)
			{
				if(i.clientName == r)
				{
					for(j of i.clientConnections)
					{
						if(j.name == s)
						{
							i.clientConnections.splice(indexOf(j), 1)
							return true;
						}
					}
				}
			}
		} // END IF
		/* Else if the connection does not already exist, and remove is false,
		 * Setup the connection */
		else if(!alreadyExists && !remove)
		{
			for(var i of this.senders)
			{
				if(i.clientName == s)
				{
					for(var j of this.receivers)
					{
						if(j.clientName == r)
						{
							i.clientConnections.push({
								name : 		j.clientName,
								mode : 		j.clientMode,
								dataType: 	j.clientDataType,
								socket : 	j.clientSocket
							});

							j.clientConnections.push({
								name : 		i.clientName,
								mode : 		i.clientMode,
								dataType: 	i.clientDataType,
								socket : 	i.clientSocket
							});


							return true;
						}
					}
				}
			}
		}
		return false;
	}

	/* Description: Updates the controllers with the latest connection
					information.
	   Arguments:   none
	   Returns:     none
     */
	this.updateControllers = function()
	{
		/* Prepare a message */
		msg = 	{
					messageType    : "connUpdate",
					messageContent :
					{
						senderList     : [],
						receiverList   : []
					}
				};
		/* Populate the message with senders */
		for(var j in this.senders)
		{
			msg.messageContent.senderList.push(
			{
				name: this.senders[j].clientName,
				mode: this.senders[j].clientMode,
				dataType: this.senders[j].clientDataType,
				connections: []
			});

			for(var k in this.senders[j].clientConnections)
			{
				msg.messageContent
				   .senderList[j]
				   .connections
				   .push({
					   		name: this.senders[j].clientConnections[k].name,
							mode: this.senders[j].clientConnections[k].mode,
							dataType: this.senders[j].clientConnections[k].dataType
						});
			}
		}
		/* Populate the message with receivers */
		for(var j in this.receivers)
		{
			msg.messageContent.receiverList.push(
			{
				name: this.receivers[j].clientName,
				mode: this.receivers[j].clientMode,
				dataType: this.receivers[j].clientDataType,
				connections: []
			});

			for(var k in this.receivers[j].clientConnections)
			{
				msg.messageContent
				   .receiverList[j]
				   .connections
				   .push({
							name: this.receivers[j].clientConnections[k].name,
							mode: this.receivers[j].clientConnections[k].mode,
							dataType: this.receivers[j].clientConnections[k].dataType
						});
			}
		}
		/* Finally go through each controller and send the message */
		for(var i in this.controllers)
		{
			this.controllers[i].clientSocket.send(JSON.stringify(msg));
		}
	}

	/* Description: Manually disconnects a client
	   Arguments:   client name
	   Returns:     none
     */
	 this.disconnect = function(name)
	 {
		for(var i in this.senders)
		{
			if(this.senders[i].clientName == name)
			{
				this.senders[i].clientSocket.close();
				return true;
			}
		}

		for(var i in this.receivers)
		{
			if(this.receivers[i].clientName == name)
			{
				this.receivers[i].clientSocket.close();
				return true;
			}
		}

		return false;
	 }

	 /* Description: Ping clients to check if they're about
		Arguments:   none
		Returns:     none
	   */
	this.pingClients = function()
	{
		/* First remove pinged connections that have not responded. When they
		   respond they are removed from the array, so we simply remove everything
		   that is still in there */
		var obj;
		for(i of this.pingedConnections)
		{
			obj = this.senders.find(o => o.clientName == i);
			if(obj == undefined)
			{
				obj = this.receivers.find(o => o.clientName == i);
				if(obj == undefined)
				{
					obj = this.controllers.find(o => o.clientName == i);
				}
			}
			console.log("Closing ");
			console.log(i);
			this.closeConnection(obj.clientSocket);
		}


		var msg = "_ping";
		for(i of this.receivers)
		{
			i.clientSocket.send(msg);
			this.pingedConnections.push(i.clientName);
		}

		for(i of this.senders)
		{
			i.clientSocket.send(msg);
			this.pingedConnections.push(i.clientName);

		}

		for(i of this.controllers)
		{
			i.clientSocket.send(msg);
			this.pingedConnections.push(i.clientName);

		}
	}

	this.handlePing = function(name)
	{
		console.log("Handling Ping");
		console.log(name);
		var i = this.pingedConnections.findIndex(o => o == name);
		this.pingedConnections.splice(i, 1);
	}
}
