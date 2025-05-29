import Record from './record'

export default class AudioManager
{
    static scene;
    static get bgmVolume() {return Record.data.bgmVolume;}
    static get sfxVolume() {return Record.data.sfxVolume;}
    static _init = false;
    static bgm0;

    static init(scene)
    {
        // console.log(scene.sound)

        this.scene = scene;
        if(!this._init)
        {
            console.log('[AudioManager Init]')
            this._init = true;
            this.bgm0 = this.scene.sound.add('bgm',{loop: true});
        }
    }

    static playSfx(sfx)
    {
        this.scene.sound.play(sfx, {volume:this.sfxVolume});
    }

    static bgmStart()
    {
        this.bgm0.setVolume(this.bgmVolume)
        console.log('playing:',this.bgm0.isPlaying)
        console.log('paused:',this.bgm0.isPaused)            
        if(this.bgm0.isPaused) {this.bgm0.resume();}
        else if(!this.bgm0.isPlaying) {this.bgm0.play();}
    }

    static bgmPause() {this.bgm0.pause();}

    static bgmStop() {this.bgm0.stop();}

    static doorOpen() {this.playSfx('doorOpen');}
    static doorClose() {this.playSfx('doorClose');}
    static drop() {this.playSfx('drop');}
}