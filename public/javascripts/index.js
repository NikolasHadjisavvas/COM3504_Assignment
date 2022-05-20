let name = null;
let roomNo = null;

let chat = io.connect('/chat');


// Initialise service url and google api key for KG.
const service_url = 'https://kgsearch.googleapis.com/v1/entities:search';
const apiKey= 'AIzaSyAG7w627q-djB4gTTahssufwNOImRqdYKM';

/**
 * called by <body onload>
 * it initialises the interface and the expected socket messages
 * plus the associated actions
 */

function init() {
    // it sets up the interface so that userId and room are selected
    document.getElementById('initial_form').style.display = 'block';
    document.getElementById('chat_interface').style.display = 'none';
    document.getElementById('typeForm').style.display = 'none';
    roomNo = document.getElementById('roomNo').value;

    if('indexedDB' in window) {
        initDatabase();
    }
    else {
        console.log('This browser doesn\'t support IndexedDB');
    }

    let roomList=JSON.parse(localStorage.getItem('roomList'));
    console.log(roomList);

    //@todo here is where you should initialise the socket operations as described in the lectures (room joining, chat message receipt etc.)
    chat.on('joined', function (room, userId) {
        if (userId === name) {
            // it enters the chat
            hideLoginInterface(roomNo, userId);
        } else {
            // notifies that someone has joined the room
            writeOnHistory('<b>' + userId + '</b>' + ' joined room ' + roomNo);
        }
    });
    // called when a message is received
    chat.on('chat', function (room, userId, chatText) {
        let who = userId
        if (userId === name) who = 'Me';
        writeOnHistory('<b>' + who + ':</b> ' + chatText);
    });

}

/**
 * it inits the widget by selecting the type from the field myType
 * and it displays the Google Graph widget
 * it also hides the form to get the type
 */
function widgetInit(){
    let type= document.getElementById("myType").value;
    if (type) {
        let config = {
            'limit': 10,
            'languages': ['en'],
            'types': [type],
            'maxDescChars': 100,
            'selectHandler': selectItem,
        }
        KGSearchWidget(apiKey, document.getElementById("myInput"), config);
        document.getElementById('typeSet').innerHTML= 'of type: '+type;
        document.getElementById('widget').style.display='block';
        document.getElementById('typeForm').style.display= 'none';
    }
    else {
        alert('Set the type please');
        document.getElementById('widget').style.display='none';
        document.getElementById('resultPanel').style.display='none';
        document.getElementById('typeSet').innerHTML= '';
        document.getElementById('typeForm').style.display= 'block';
    }
}

/**
 * callback called when an element in the widget is selected
 * @param event the Google Graph widget event {@link https://developers.google.com/knowledge-graph/how-tos/search-widget}
 */
function selectItem(event){
    let row= event.row;
    let roomId=document.getElementById('roomNo').value;
    let story = document.getElementById('story_title').value;
    let KGannot =  new KGAnnotation(roomId,story,row.id,row.name,row.rc,row.qc);
    storeCachedAnnotation(KGannot);

    let tbody = document.getElementById('tbody_KG');

    // Creating and adding data to first row of the table
    let table_row = document.createElement('tr');
    let heading_1 = document.createElement('td');
    heading_1.innerText = row.id;
    let heading_2 = document.createElement('td');
    heading_2.innerText = row.name;
    let heading_3 = document.createElement('td');
    heading_3.innerText = row.rc;
    let heading_4 = document.createElement('td');
    heading_4.innerText = row.qc;

    table_row.appendChild(heading_1);
    table_row.appendChild(heading_2);
    table_row.appendChild(heading_3);
    table_row.appendChild(heading_4);
    tbody.appendChild(table_row);


}

/**
 * currently not used. left for reference
 * @param id
 * @param type
 */
function queryMainEntity(id, type){
    const  params = {
        'query': mainEntityName,
        'types': type,
        'limit': 10,
        'indent': true,
        'key' : apiKey,
    };
    $.getJSON(service_url + '?callback=?', params, function(response) {
        $.each(response.itemListElement, function (i, element) {
            $('<div>', {text: element['result']['name']}).appendTo(document.body)
        });
    });

}

function showKGForm(){
    document.getElementById('typeForm').style.display = 'block';
}



/**
 * given the list of previously visited stories for the user, it will retrieve all the STORIES data from
 * the server (or failing that) from the indexedDB, and the annotations of each story from indexedDB
 * @param forceReload true if the data is to be loaded from the server
 */
/*
function loadData(forceReload){
    var roomList=JSON.parse(localStorage.getItem('roomList'));
    roomList=removeDuplicates(roomList);
    retrieveAllStoriesData(roomList, forceReload);
}
*/
/**
 * it cycles through the list of stories and requests the data from the server for each
 * story
 * @param roomList the list of the cities the user has requested
 * @param date the date for the forecasts (not in use)
 * @param forceReload true if the data is to be retrieved from the server
 */
/*
function retrieveAllStoriesData(roomList, forceReload){
    refreshStoryList();
    for (let index in roomList)
        loadStoryData(roomList[index], forceReload);
}
*/

/**
 * given one story, it queries the mongoDB to get the latest
 * the story object
 * if the request to the server fails, it shows the data stored in the indexedDB
 * @param title
 * @param forceReload true if the data is to be retrieved from the server
 */
async function loadStoryData(title,forceReload){
    let cachedData=await getCachedStoryData(title);
    if(!forceReload && cachedData && cachedData.length>0){
        for (let res of cachedData) {
            addToResults(res);
        }
        return cachedData[0];
    }
    else{
        const input = JSON.stringify({title:title});
        $.ajax({
            url:'/getSelectedStoryData',
            data: input,
            contentType: 'application/json',
            type: 'POST',
            success: function(dataR){
                //addToResults(dataR);
                //handleResponse(dataR);
                console.log('DATA FETCHED',dataR);
                if(document.getElementById('offline_div')!=null)
                    document.getElementById('offline_div').style.display='none';
            },
            //If the server request has failed, show the cached data
            error: function (xhr,status,error) {
                alert(error);
                //showOfflineWarning();
                const dvv = document.getElementById('offline_div');
                if(dvv!=null)
                    dvv.style.display='block';
                //handleResponse(getCachedStoryData(title));
            }
        });
    }

    if(document.getElementById('story_list')!=null)
        document.getElementById('story_list').style.display='none';
}

function addToResults(dataR) {
    if (document.getElementById('results') != null) {
        let bodyElement=document.getElementById('results');
        let cardElement = document.createElement('div');
        let imageContainer = document.createElement('div');
        let infoContainer = document.createElement('div');
        let imageElement  = document.createElement('img');
        let headingElement = document.createElement('h5');
        let authorElement = document.createElement('h5');
        let paragraphElement = document.createElement('p');
        let btnElement = document.createElement('a');

        let formId = "form"+ Math.random().toString();
        let formElement = document.createElement('form');
        formElement.setAttribute("id", formId);
        formElement.setAttribute("method", "post");
        formElement.setAttribute("action", "/individual_storyPage");
        //formElement.setAttribute("onsubmit","/individual_storyPage");
        var titleInput = document.createElement("input");
        titleInput.setAttribute("type", "text");
        titleInput.setAttribute("name", "title");
        titleInput.setAttribute("value", dataR.title);
        titleInput.setAttribute("readonly", "true");

        var authorInput = document.createElement("input");
        authorInput.setAttribute("type", "text");
        authorInput.setAttribute("name", "author");
        authorInput.setAttribute("value", dataR.author);
        authorInput.setAttribute("readonly", "true");

        var descriptionInput = document.createElement("input");
        descriptionInput.setAttribute("type", "text");
        descriptionInput.setAttribute("name", "description");
        descriptionInput.setAttribute("value", dataR.description);
        authorInput.setAttribute("readonly", "true");

        var imageInput = document.createElement("input");
        imageInput.setAttribute("type", "text");
        imageInput.setAttribute("name", "imageUrl");
        imageInput.setAttribute("value", dataR.imageUrl);
        imageInput.setAttribute("readonly", "true");

        let btn = document.createElement('input');
        btn.setAttribute("type", "submit");
        btn.setAttribute("value", "Read");

        formElement.appendChild(titleInput);
        formElement.appendChild(authorInput);
        formElement.appendChild(descriptionInput);
        formElement.appendChild(imageInput);
        formElement.appendChild(btn);

        bodyElement.appendChild(formElement);
        titleInput.style.display  = 'none';
        authorInput.style.display  = 'none';
        descriptionInput.style.display  = 'none';
        imageInput.style.display  = 'none';
        //document.getElementById(formId).style.display = "none";


        cardElement.className = "storyCard";
        imageContainer.className = "image-container";
        infoContainer.className = "info-container"
        imageElement.className = "image";
        headingElement.className = "heading";
        authorElement.className = "author";
        paragraphElement.className = "paragraph";
        btnElement.className = "btn";
        imageElement.src=dataR.imageUrl;
        imageElement.setAttribute("alt","Image of story");
        headingElement.innerText=dataR.title;
        authorElement.innerText="By: "+dataR.author;
        paragraphElement.innerText="About: "+dataR.description;

        bodyElement.appendChild(cardElement);
        cardElement.append(imageContainer,infoContainer);

        imageContainer.appendChild(imageElement);
        infoContainer.append(headingElement,authorElement,paragraphElement,formElement);
    }
}

async function storeStoryINIdb() {
    let author=document.getElementById('authorName').value;
    let title=document.getElementById('authorTitle').value;
    let desc=document.getElementById('authorDescription').value;
    let url=document.getElementById('image_url').value;
    storeCachedStory(author,title,desc,url);
}

//Called every time the user connects to a room.
//So that we keep track of which rooms were visited.
function selectRoom(roomId) {
    var roomList=JSON.parse(localStorage.getItem('roomList'));
    if (roomList==null)
        roomList=[];
    roomList.push(roomId);
    roomList = removeDuplicates(roomList);
    localStorage.setItem('roomList', JSON.stringify(roomList));
    console.log('room '+roomId+' added to roomList');
}

/**
 * Given a list of rooms, it removes any duplicates
 * @param roomList
 * @returns {Array}
 */
function removeDuplicates(roomList) {
    // remove any duplicate
    var uniqueNames=[];
    $.each(roomList, function(i, el){
        if($.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
    });
    return uniqueNames;
}

/**
 * called to generate a random room number
 * This is a simplification. A real world implementation would ask the server to generate a unique room number
 * so to make sure that the room number is not accidentally repeated across uses
 */
function generateRoom() {
    roomNo = Math.round(Math.random() * 10000);
    document.getElementById('roomNo').value = 'R' + roomNo;
}

/**
 * called when the Send button is pressed. It gets the text to send from the interface
 * and sends the message via  socket
 */
async function sendChatText() {
    let chatText = document.getElementById('chat_input').value;

    let roomId=document.getElementById('roomNo').value;
    let story = document.getElementById('story_title').value;
    const annot_object = new WrittenAnnotation(roomId,story,chatText); //Create the text(annotation) object as soon as it's created.Cache it using indexedDB(storecachedData)
    storeCachedAnnotation(annot_object);

    // @todo send the chat message
    chat.emit('chat', roomNo, name, chatText);
    document.getElementById('chat_input').value='';
}

/**
 * used to connect to a room. It gets the user name and room number from the
 * interface
 */
async function connectToRoom() {
    roomNo = document.getElementById('roomNo').value;
    name = document.getElementById('firstname').value;
    let title=document.getElementById('story_title').value;

    selectRoom(roomNo); // Add the room to the lists of rooms visited.
    const storyData = await loadStoryData(title,false)
        .then((response) => {
            return JSON.stringify(response);
        })

    if (!name) name = 'Unknown-' + Math.random();
    //@todo join the room
    chat.emit('create or join', roomNo, name);
    initCanvas(chat, JSON.parse(storyData).imageUrl);
    hideLoginInterface(roomNo, name);

    //set story details in view.
    let row=document.getElementById('story_desc');
    row.innerHTML =
        "<p>  <b>Author:</b>"+ JSON.parse(storyData).author+"</p>"+
        "<p>  <b>Title:</b>"+ JSON.parse(storyData).title+"</p>"+
        "<p>  <b>Description:</b>"+ JSON.parse(storyData).description+"</p>";
}

/**
 * it appends the given html text to the history div
 * this is to be called when the socket receives the chat message (socket.on ('message'...)
 * @param text: the text to append
 */
function writeOnHistory(text) {
    if (text==='') return;
    let history = document.getElementById('history');
    let paragraph = document.createElement('p');
    paragraph.innerHTML = text;
    history.appendChild(paragraph);
    // scroll to the last element
    history.scrollTop = history.scrollHeight;
    document.getElementById('chat_input').value = '';
}

/**
 * it hides the initial form and shows the chat
 * @param room the selected room
 * @param userId the user name
 */
function hideLoginInterface(room, userId) {
    document.getElementById('initial_form').style.display = 'none';
    document.getElementById('chat_interface').style.display = 'block';
    document.getElementById('who_you_are').innerHTML= userId;
    document.getElementById('in_room').innerHTML= ' '+room;
    document.getElementById('results').style.display = 'none';
    document.getElementById('center').style.display = 'none';
}


// These two functions are used to get the data from the form and send it to the controller I think
// I am not sure, I took them from the lab
function sendAxiosQuery(url, data) {
    axios.post(url, data)
        .then((dataR) => {// no need to JSON parse the result, as we are using
            // we need to JSON stringify the object
            document.getElementById('results').innerHTML = JSON.stringify(dataR.data);
        })
        .catch(function (response) {
            alert(response);
        })
}

async function onSubmit(url) {
    var formArray= $("form").serializeArray();
    var data={};
    for (index in formArray){
        data[formArray[index].name]= formArray[index].value;
    }
    // const data = JSON.stringify($(this).serializeArray());
    sendAxiosQuery(url, data);
    event.preventDefault();
}


function sendAxiosQuery_2(url, data) {
    axios.post(url, data)
        .then((dataR) => {// no need to JSON parse the result, as we are using
            // we need to JSON stringify the object
            //document.getElementById('results').innerHTML = JSON.stringify(dataR.data);
            console.log(dataR.data);
            for (d of dataR.data){
                addToResults(d);
            }
        })
        .catch(function (response) {
            alert(response);
        })
}

async function onSubmit_2(url) {
    var formArray= $("form").serializeArray();
    var data={};
    for (index in formArray){
        data[formArray[index].name]= formArray[index].value;
    }
    // const data = JSON.stringify($(this).serializeArray());
    sendAxiosQuery_2(url, data);
    event.preventDefault();
}

// Create the annotations/story classes.(NOT SURE IF WE REALLY NEED THEM,IF NOT IGNORE)
// We define an annotation object by specifying story(the story where the annotation belongs to) and the body(the chat text).
//I've changed the story field to room, because the annotations are linked to the room,not the story.
class WrittenAnnotation{
    constructor(room, story, body) {
        this.room=room;
        this.story=story;
        this.body=body;
    }
}

class DrawnAnnotation{
    constructor(room, story, canvas_width, canvas_height, prevX, prevY, currX, currY, color, thickness) {
        this.room=room;
        this.story=story;
        this.canvas_width = canvas_width;
        this.canvas_height = canvas_height;
        this.prevX = prevX;
        this.prevY = prevY;
        this.currX = currX;
        this.currY = currY;
        this.color = color;
        this.thickness = thickness;
    }
}

class KGAnnotation{
    constructor(room, story, resId, resName, resDescription, resUrl) {
        this.room=room;
        this.story=story;
        this.resId = resId;
        this.resName = resName;
        this.resDescription = resDescription;
        this.resUrl = resUrl;
    }
}