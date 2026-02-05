import {GM} from './core/setting.js'

import PressService from './services/pressService.js'
import DragService from './services/dragService.js'

import UiStorage from './ui/uistorage.js'
import UiMain from './ui/uimain.js'
import UiOption from './ui/uioption.js'
import UiInv from './ui/uiinv.js'
import UiProfile from './ui/uiprofile.js'
import UiDialog from './ui/uidialog.js'
import UiTrade from './ui/uitrade.js'
import UiInfo from './ui/uiinfo.js'
import UiObserve from './ui/uiobserve.js'
import UiCount from './ui/uicount.js'
import UiConfirm from './ui/uiconfirm.js'
import UiAbility from './ui/uiability.js'
import UiDebuger from './ui/uidebuger.js'
import UiCursor from './ui/uicursor.js'
import UiEffect  from './ui/uieffect.js'
import UiTime  from './ui/uitime.js'
import UiMessage  from './ui/uimessage.js'
import UiChangeScene  from './ui/uichangescene.js'
import UiGameOver  from './ui/uigameover.js'
import UiManufacture  from './ui/uimanufacture.js'
import UiCover  from './ui/uicover.js'
import UiDragged  from './ui/uidragged.js'
import UiMisc  from './ui/uimisc.js'

import UiTest from './ui/uitest.js'


let uiScene;
let _mode = 0;


function getSuper(obj) 
{
  let proto = Object.getPrototypeOf(Object.getPrototypeOf(obj));
  return proto;
}

function getRoot(obj) 
{
  let proto = Object.getPrototypeOf(obj);        // Avatar.prototype
  while (Object.getPrototypeOf(proto)) {         // 繼續往上爬
    proto = Object.getPrototypeOf(proto);
  }
  
  return proto; // 這會是 Object.prototype
}

export default function createUI(scene)
{
    console.log('createUI');
    GM.w = scene.sys.canvas.width;
    GM.h = scene.sys.canvas.height;
    uiScene = scene;
    console.log('resolution:',GM.w, GM.h)

    PressService.bindToScene(scene);
    DragService.init(scene);

    new UiCover(scene);             // 1
    new UiAbility(scene);
    new UiMain(scene);              // 2
    new UiEffect(scene);

    new UiTime(scene);              // 19
    new UiManufacture(scene);       // 3
    new UiProfile(scene);           // 4
    new UiCursor(scene);            // 5
    new UiInv(scene);               // 6
    new UiTrade(scene);             // 7
    new UiStorage(scene);           // 8
    new UiMisc(scene);              // 20
    new UiDialog(scene);            // 9
    new UiObserve(scene);           // 10
    new UiCount(scene);             // 11
    new UiDragged(scene, 80, 80);   // 12
    
    new UiInfo(scene);              // 13
    new UiOption(scene);            // 14
    new UiMessage(scene);           // 15
    new UiGameOver(scene);          // 16
    new UiChangeScene(scene);       // 17
    new UiDebuger(scene);           // 18

    
    new UiConfirm(scene);

    // new UiManufacture_1(scene);
    // new UiTest(scene);
    UiChangeScene.show();
    test1();
    test2();
    
}

async function test1()
{
	console.log('--- 1')
  	await Promise.resolve(1);//new Promise((resolve)=>{resolve(true)});
  	console.log('--- 2')

}

function test2()
{
	console.log('--- 3')

}

function setCamera(mode) 
{
    _mode |= mode;
    uiScene.events.emit('camera',_mode);
}

function clrCamera(mode) 
{
    _mode &= ~mode;
    uiScene.events.emit('camera',_mode);
}

function clearpath() {uiScene.events.emit('clearpath');}




