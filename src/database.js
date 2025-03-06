import {GM} from './setting.js';

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
        'sword_01':{cat:GM.CAT_WEAPON,icon:'weapons/3',name:'刀-1',gold:15,
                    des:'這是一把刀',
                    props:{attack:20}},
        'sword_02':{cat:GM.CAT_WEAPON,icon:'weapons/4',name:'刀-2',gold:25,
                    props:{attack:40}},
        'sword_03':{cat:GM.CAT_WEAPON,icon:'weapons/5',name:'刀-3',gold:35,
                    props:{attack:60}},

        'helmet_01':{cat:GM.CAT_HELMET,icon:'weapons/45',name:'高級頭盔-1',gold:10,
                    des:'這是頭盔',
                    props:{defense:1}},
        'helmet_02':{cat:GM.CAT_HELMET,icon:'weapons/46',name:'頭盔-2',
                    props:{defense:2}},
        'helmet_03':{cat:GM.CAT_HELMET,icon:'weapons/47',name:'頭盔-3',
                    props:{defense:3}},

        'chest_01':{cat:GM.CAT_CHESTPLATE,icon:'weapons/54',name:'胸甲-1',gold:20,
                    des:'這是護甲',
                    props:{defense:2}},
        'chest_02':{cat:GM.CAT_CHESTPLATE,icon:'weapons/55',name:'胸甲-2',gold:20,
                    props:{defense:4}},
        'chest_03':{cat:GM.CAT_CHESTPLATE,icon:'weapons/56',name:'胸甲-3',gold:20,
                    props:{defense:6}},

        'gloves_01':{cat:GM.CAT_GLOVES,icon:'icons/128',name:'手套-1',gold:10,des:'手套',
                    props:{defense:1}},

        'boots_01':{cat:GM.CAT_BOOTS,icon:'icons/130',name:'靴子-1',gold:10,des:'靴子',
                    props:{defense:2}},

        'neck_01':{cat:GM.CAT_NECKLACE,icon:'icons/134',name:'項鍊-1',gold:10,des:'項鍊'},

        'ring_01':{cat:GM.CAT_RING,icon:'icons/132',name:'戒子-1',gold:10,des:'戒子'},

        'torch':{cat:GM.CAT_ITEM,icon:'icons/170',name:'火把',gold:10,des:'火把'},


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
                    sprite:'Warrior_Red', faceR:true,
                    corpse:{sprite:'rip',scale:0.5},
                    anchor:{x:64,y:48}, w:128, h:128,
                    b:{l:48,r:48,t:32,b:32},
                    g:{l:48,r:48,t:64,b:32},
                    z:{l:48,r:48,t:64,b:32},
                    bag:{capacity:5,items:[]},
                    attrs:
                        {
                            attack: 5,
                            defense: 0,
                        },
                    states:
                        {
                            life: {cur:100,max:100},
                        }
                },

        'knight': {name:'騎士', icon:'portraits/35', gold:200,
                    sprite:'Warrior_Red', faceR:true,
                    corpse:{sprite:'rip',scale:0.5},
                    looties:[{id:'sword_02',p:50}, 'helmet_02'],
                    anchor:{x:64,y:48}, w:128, h:128,
                    b:{l:48,r:48,t:32,b:32},
                    g:{l:48,r:48,t:64,b:32},
                    z:{l:48,r:48,t:64,b:32},
                    restock:2,
                    bag:{capacity:-1,items:['sword_01',{id:'helmet_01'},'chest_01','gloves_01','boots_01','neck_01','ring_01','torch']},
                    attrs:
                    {
                        attack: 5,
                        defense: 0,
                    },
                    states:
                    {
                        life: {cur:100, max:100},
                    },
                    schedule:
                    {
                        village_01:
                        [   {type:'enter',  range:['6:00','6:10'],      from:'門-1',    to:'point-1'}, 
                            {type:'stay',   range:['6:10','17:00'],     pos:'point-1'},
                            {type:'exit',   range:['17:00','17:10'],    from:'point-1', to:'門-1'},
                        ],
                        house_01:
                        [   {type:'stay',   range:['0:00','5:50'],      pos:'point-1'},
                            {type:'exit',   range:['5:50','6:00'],      from:'point-1',     to:'門'},
                            {type:'enter',  range:['17:10','17:20'],    from:'門',          to:'point-1'},
                            {type:'stay',   range:['17:20','24:00'],    pos:'point-1'}, 
                        ],
                    },
                },

        'archer': {name:'射手', icon:'portraits/40', gold:100,
                    sprite:'Archer_Blue', faceR:true,
                    anchor:{x:64,y:48}, w:128, h:128,
                    b:{l:48,r:48,t:32,b:32},
                    g:{l:48,r:48,t:64,b:32},
                    z:{l:48,r:48,t:32,b:32},
                    bag:{},
                    attrs:
                        {
                            attack: 5,
                            defense: 0,
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


export class Roles
{
    static list = ['knight'];
}