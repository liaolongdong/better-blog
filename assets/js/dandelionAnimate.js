(function (window, document) {
    var canvas = document.querySelector('#dandelionCanvas')
    const randomInt = (min, max) => Math.floor( Math.random() * ( max - min ) + min)
    // get canvas

    var _w, _h
    function refreshSize() {
        _w = canvas.width = innerWidth
        _h = canvas.height = innerHeight
    };
    refreshSize();
    // set width and height to canvas

    var c = canvas.getContext( '2d')
    // get context now you can draw from here 
    class Flower {
        constructor( x, y, radius) {
            this.x = x
            this.y = y
            this.radius = radius
            this.dx = 0.8 + Math.random() * 0.2
            this.fdx = Math.pow( this.dx, 15)
            this.radians = 0
        }
        draw() {
            let long = this.radius * 20
            let cutLong = long / 10
            c.beginPath()
            c.strokeStyle = '#fff'
            c.arc( this.x, this.y, this.radius, 0, Math.PI * 2, true)
            c.moveTo(this.x, this.y + this.radius)
            c.lineTo(this.x, this.y + long)
            c.stroke()
            c.beginPath()
            c.save()
            c.strokeStyle = '#725527'
            c.lineWidth = cutLong
            c.lineCap = 'round'
            c.moveTo( this.x, this.y + long - cutLong)
            c.lineTo( this.x, this.y + long + cutLong)
            c.stroke()
            c.restore()
            c.beginPath()
            c.save()
            c.globalAlpha = 0.5
            for ( let i = 0.5; i < 5; i++ ) {
                c.moveTo( this.x, this.y)
                c.quadraticCurveTo( this.x + cutLong,this.y + cutLong,
                                    this.x + cutLong * i, this.y - cutLong * 1.5)
                c.moveTo( this.x, this.y)
                c.quadraticCurveTo( this.x - cutLong,this.y + cutLong,
                                    this.x - cutLong * i, this.y - cutLong * 1.5)
            }
            c.lineWidth = 1
            c.stroke()
            c.restore()
            
        }
        createFlower( array = [] ) {
            let i = array.indexOf( this )
            array.splice( i, 1)
            let x = 0
            let y = randomInt( -10, _h * 1.5)
            array.push( new Flower( x, y, this.radius) ) 
        }
        update( array = [] ) {
            if ( this.x - this.radius > _w )
            this.createFlower( array )
            this.radians += 0.01
            this.x += this.dx
            this.y += Math.cos( this.radians ) - this.fdx 
            this.draw()
        }
    }

    var flowers = []

    function init() {
        for ( let i = 0; i < 100; i++ ) {
            let x = Math.random()  * _w 
            let y = randomInt( -10, _h * 1.5)
            flowers.push( new Flower( x, y, 1))
        }
    };
    init();
    // a IIFE 

    function loop() {
        requestAnimationFrame(loop)
        refreshSize()
        flowers.forEach( f => f.update( flowers ) )
    };
    loop();
// loop to animate
})(window, document);