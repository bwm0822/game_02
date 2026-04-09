import {GM} from '../core/setting.js'
import {T,dlog} from '../core/debug.js'
import Utility from '../core/utility.js'

import PressService from '../services/pressService.js'
import DragService from '../services/dragService.js'

import UiStorage from './uistorage.js'
import UiMain from './uimain.js'
import UiOption from './uioption.js'
import UiInv from './uiinv.js'
import UiProfile from './uiprofile.js'
import UiDialog from './uidialog.js'
import UiTrade from './uitrade.js'
import UiInfo from './uiinfo.js'
import UiObserve from './uiobserve.js'
import UiCount from './uicount.js'
import UiConfirm from './uiconfirm.js'
import UiAbility from './uiability.js'
import UiDebuger from './uidebuger.js'
import UiCursor from './uicursor.js'
import UiEffect  from './uieffect.js'
import UiTime  from './uitime.js'
import UiMessage  from './uimessage.js'
import UiChangeScene  from './uichangescene.js'
import UiGameOver  from './uigameover.js'
import UiManufacture  from './uimanufacture.js'
import UiCover  from './uicover.js'
import UiDragged  from './uidragged.js'
import UiMisc  from './uimisc.js'
import UiMapLegend  from './uimaplegend.js'

import UiTest from './uitest.js'


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
    dlog(T.UI)('createUI');
    GM.w = scene.sys.canvas.width;
    GM.h = scene.sys.canvas.height;
    uiScene = scene;
    dlog(T.UI)('resolution:',GM.w, GM.h)

    PressService.bindToScene(scene);
    DragService.init(scene);

    new UiCover(scene);             // 1
    new UiAbility(scene);
    new UiMain(scene);              // 2
    new UiEffect(scene);
    new UiMapLegend(scene);

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
    new UiDebuger(scene);           // 18
    new UiConfirm(scene);

    new UiChangeScene(scene);       // 17

    UiChangeScene.show();
    
    //
    test();
}


function test() 
{
    let str='🌍';
    console.log(str,Utility.hasEmoji(str));
    str='buffs:1';
    console.log(str,Utility.hasEmoji(str));

    console.log('---------------------------- lifesteal=','lifesteal'.des({num: 25}));
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




