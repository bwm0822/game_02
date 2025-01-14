
export class RoleData
{
    constructor()
    {
        this.data =
        {
            equip:{},
            bag:{},
            gold:0,
        }
    }

    get equip() {return this.data.equip;}
    get bag() {return this.data.bag;}
    get gold() {return this.data.gold;}

    
}

export class ItemDB
{
    static data = 
    {
        'sword_01':{cat:'weapon',icon:'weapons/3',name:'刀-1',gold:10,
                    des:'這是一把刀',
                    props:{damage:10,defend:1}},
        'sword_02':{cat:'weapon',icon:'weapons/4',name:'刀-2'},
        'sword_03':{cat:'weapon',icon:'weapons/5',name:'刀-3'},

        'helmet_01':{cat:'helmet',icon:'weapons/45',name:'高級頭盔-1',
                    des:'這是頭盔,這是頭盔,這是頭盔,這是頭盔,這是頭盔,這是頭盔,這是頭盔,'},
        'helmet_02':{cat:'helmet',icon:'weapons/46',name:'頭盔-2'},
        'helmet_03':{cat:'helmet',icon:'weapons/47',name:'頭盔-3'},

        'armor_01':{cat:'armor',icon:'weapons/54',name:'護甲-1',
                    des:'這是護甲',
                    props:{defend:10}},
        'armor_02':{cat:'armor',icon:'weapons/55',name:'護甲-2'},
        'armor_03':{cat:'armor',icon:'weapons/56',name:'護甲-3'},
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