# Message Actions

Execute Quick Replies on specific messages.






## Installation

Use ST's inbuilt extension installer with this URL:  
https://github.com/LenAnderson/SillyTavern-MessageActions/




## Usage

Use the `/messageactions` slash command to configure which Quick Reply sets are added to the message menus.

```
/messageactions MyQrSet
/messageactions MyQrSet, MyOtherQrSet
/messageactions "MyQrSet", "My Other Qr Set"
```

`/messageactions` Will remove all QR sets.

Quick Replies executed through the message buttons have the `{{mes::...}}` macro available.

```
{{mes::id}} - the message's ID / index
{{mes::mes}} - the message text
{{mes::swipes}} - the array of swipes
{{mes::swipes::0}} - the first swipe
{{mes::swipe_id}} - the currently selected swipe index
{{mes::name}} - name of the char / persona that has sent the message
```

To see what else is available in the message object, open a chat in SillyTavern and enter the following into your browser's console.

```javascript
SillyTavern.getContext().chat[1]
```




## Requirements

- SillyTavern version >=1.11.2
