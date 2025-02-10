import {UI} from './uibase.js';

// export class RoleData
// {
//     constructor()
//     {
//         this.data =
//         {
//             equip:{},
//             bag:{},
//             gold:0,
//         }
//     }

//     get equip() {return this.data.equip;}
//     get bag() {return this.data.bag;}
//     get gold() {return this.data.gold;}
// }

export class ItemDB
{
    static data = 
    {
        'sword_01':{cat:UI.CAT_WEAPON,icon:'weapons/3',name:'刀-1',gold:15,
                    des:'這是一把刀',
                    props:{attack:10}},
        'sword_02':{cat:UI.CAT_WEAPON,icon:'weapons/4',name:'刀-2',
                    props:{attack:10}},
        'sword_03':{cat:UI.CAT_WEAPON,icon:'weapons/5',name:'刀-3',
                    props:{attack:10}},

        'helmet_01':{cat:UI.CAT_HELMET,icon:'weapons/45',name:'高級頭盔-1',gold:10,
                    des:'這是頭盔',
                    props:{defend:1}},
        'helmet_02':{cat:UI.CAT_HELMET,icon:'weapons/46',name:'頭盔-2',
                    props:{defend:1}},
        'helmet_03':{cat:UI.CAT_HELMET,icon:'weapons/47',name:'頭盔-3',
                    props:{defend:1}},

        'chest_01':{cat:UI.CAT_CHESTPLATE,icon:'weapons/54',name:'胸甲-1',gold:20,
                    des:'這是護甲',
                    props:{defend:2}},
        'chest_02':{cat:UI.CAT_CHESTPLATE,icon:'weapons/55',name:'胸甲-2',gold:20,
                    props:{defend:2}},
        'chest_03':{cat:UI.CAT_CHESTPLATE,icon:'weapons/56',name:'胸甲-3',gold:20,
                    props:{defend:2}},

        'gloves_01':{cat:UI.CAT_GLOVES,icon:'icons/128',name:'手套-1',gold:10,des:'手套',
                    props:{defend:1}},

        'boots_01':{cat:UI.CAT_BOOTS,icon:'icons/130',name:'靴子-1',gold:10,des:'靴子',
                    props:{defend:1}},

        'neck_01':{cat:UI.CAT_NECKLACE,icon:'icons/134',name:'項鍊-1',gold:10,des:'項鍊'},

        'ring_01':{cat:UI.CAT_RING,icon:'icons/132',name:'戒子-1',gold:10,des:'戒子'},


    }

    static get(id)
    {
        return ItemDB.data?.[id];
    }
}

export class DialogDB
{
    static data = {
        '阿修羅':
        {
            name:'阿修羅',
            0:
                {
                    text:'阿修羅:\nHi~冒險者~\n我是阿修羅，\n我有一些有挑戰性的任務，\n報酬很不錯，\n你有沒有興趣...',
                    next:'go 1',
                },
            1:
                {
                    text:[
                        '你:\n',
                        '[area=1][bgcolor=blue]沒興趣[/bgcolor][/area]\n',
                        '[area=2][bgcolor=blue]說來聽聽[/bgcolor][/area]\n',
                        ],
                    options:{1:'exit',2:'go 任務1'} ,
                },
            任務1:
                {
                    text:'阿修羅:\n殺死哥布林\n'+
                        '[area=1][bgcolor=blue]接受[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]不接受[/bgcolor][/area]\n',
                    options:{1:'save 任務1_going;quest q01;exit',2:'exit'} ,

                },
            任務1_going:
                {
                    text:['阿修羅:\n任務完成了嗎?\n',
                        {cond:false,text:'[area=1][bgcolor=blue]完成了[/bgcolor][/area]\n'},
                        '[area=2][bgcolor=blue]還沒[/bgcolor][/area]\n'],
                    options:{1:'go 任務1_close',2:'exit'} ,
                },
            任務1_close:
                {
                    text:'阿修羅:\n謝謝，請收下你的獎勵',
                    next:'go 任務2',
                },
            任務2:
                {
                    text:'阿修羅:\n任務2:殺死史萊姆，你要接嗎?\n'+
                        '[area=1][bgcolor=blue]接受[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]不接受[/bgcolor][/area]\n',
                    options:{1:'exit',2:'go 1'} ,
                }
        },
        '哥布林':
        {
            name:'哥布林',
            0:  {
                    text:'你:\n你是哥布林嗎?',
                    next:'go 1',
                },
            1:  {
                    text:'哥布林:\n滾~~~想吃拳頭嗎?',
                    next:'go 2',
                },
            2:  {
                    text:'你:\n'+
                        '[area=1][bgcolor=blue]我安排你去見上帝[/bgcolor][/area]\n'+
                        '[area=2][bgcolor=blue]離開[/bgcolor][/area]\n',
                    options:{1:'exit;battle 哥布林',2:'exit'} ,
                },
        },
        'scott':
        {
            0:
            {   
                A:'你好\n1\n2\n3\n4\n5\n6',
                B:['1.交易/trade','2.離開/exit']
            }
        },
        'knight':
        {
            0:
            {   
                A:'你好\n1\n2\n3\n4\n5\n6',
                B:['1.交易/trade','2.離開/exit']
            }
        },
        'archer':
        {
            0:
            {   
                A:'你好\n1\n2\n3\n4\n5\n6',
                B:['1.交易/trade','2.離開/exit']
            }
        }

    }

    static get(id)
    {
        return DialogDB.data[id];
    }
}

export class QuestDB
{
    static data = {
        'q01':{title:'清除哥布林',descript:'清除哥布林',rewards:{gold:100,items:[]},act:{type:'add',map:'town_01',id:'哥布林',x:100,y:100}}
    };

    static get(id)
    {
        return QuestDB.data[id];
    }

}

export class RoleDB
{
    static data = 
    {
        'scott': {name:'史考特', icon:'portraits/35', gold:200,
                    bag:['sword_01',{id:'helmet_01'}]},

        'knight': {name:'騎士', icon:'portraits/35', gold:200,
                    sprite:'Warrior_Red', faceR:true,
                    anchor:{x:64,y:48}, w:128, h:128,
                    b:{l:48,r:48,t:32,b:32},
                    g:{l:48,r:48,t:64,b:32},
                    z:{l:48,r:48,t:64,b:32},
                    bag:['sword_01',{id:'helmet_01'},'chest_01','gloves_01','boots_01','neck_01','ring_01'],
                    attrs:
                        {
                            attack: 5,
                            defend: 0,
                        },
                    states:
                        {
                            life: {cur:100,max:100},
                        }
                },

        'archer': {name:'射手', icon:'portraits/40', gold:100,
                    sprite:'Archer_Blue', faceR:true,
                    anchor:{x:64,y:48}, w:128, h:128,
                    b:{l:48,r:48,t:32,b:32},
                    g:{l:48,r:48,t:64,b:32},
                    z:{l:48,r:48,t:32,b:32},
                    bag:[],
                    attrs:
                        {
                            attack: 5,
                            defend: 0,
                        },
                    states:
                        {
                            life: {cur:100,max:100},
                        }
                }

    }

    static get(id)
    {
        return RoleDB.data[id];
    }
}


export class CharacterDB
{
    static data = {
        '哥布林': {icon:'hero/112'}
    }

    static get(id)
    {
        return CharacterDB.data[id];
    }
}