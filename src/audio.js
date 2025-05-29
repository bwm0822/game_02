import Record from './record'

export default class AudioManager
{
    static scene;
    static get bgmVolume() {return Record.data.bgmVolume;}
    static get sfxVolume() {return Record.data.sfxVolume;}

    static init(scene)
    {
        // console.log(scene.sound)
        this.scene = scene;
    }

    static playSfx(sfx)
    {
        this.scene.sound.play(sfx, {volume:this.sfxVolume});
    }

    static doorOpen() {this.playSfx('doorOpen');}
    static doorClose() {this.playSfx('doorClose');}
    static drop() {this.playSfx('drop');}
}