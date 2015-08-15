"use strict";

minidm.controller("minidmCtrl", function ($scope, hotkeys) {

    // properties & configuration

    $scope.play = false;
    $scope.tempo = 120;
    $scope.currentTick = 0;
    
    $scope.filterFrequency = 5000;
    $scope.filterQ = 5;
    
    $scope.drumGrid = null;    
    $scope.activeNotes = {};
    
    $scope.drumSamples = [
      {file: "./samples/bassdrum.wav",   name: "BASS",   fitlerFrequency: $scope.filterFrequency, filterQ: $scope.filterQ}, 
      {file: "./samples/kickdrum.wav",   name: "KICK",   fitlerFrequency: $scope.filterFrequency, filterQ: $scope.filterQ}, 
      {file: "./samples/snaredrum1.wav", name: "POCx1", fitlerFrequency: $scope.filterFrequency, filterQ: $scope.filterQ},
      {file: "./samples/snaredrum2.wav", name: "POCx2", fitlerFrequency: $scope.filterFrequency, filterQ: $scope.filterQ}, 
      {file: "./samples/hihat.wav",      name: "CLAPS",      fitlerFrequency: $scope.filterFrequency, filterQ: $scope.filterQ}
    ];
    
    $scope.noteKeys = ['z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'j', 'm',    
                       'q', '1', 'w', '3', 'e', 'r', '5', 't', '7', 'y', '9', 'u',
                       'i', '0', 'o', '0', 'p'];
                                
    $scope.noteKeysActive = [];
    
    // sound generation

    $scope.randomize = function() {
        $scope.drumGrid=[];
        for (var i=0; i<$scope.drumSamples.length; i++) {
            $scope.drumGrid[i]=[];
            for (var j=0; j<16; j++) {
                $scope.drumGrid[i][j]=(Math.random()>0.75)?true:false;
            }
        }
    };

    $scope.clear = function() {
        $scope.drumGrid=[];
        for (var i=0; i<$scope.drumSamples.length; i++) {
            $scope.drumGrid[i]=[];
        }
    };        
    
    $scope.checkAndPlayWav = function(index, tick, onlyWhenStopped) {
        if (onlyWhenStopped && $scope.play)
            return;
            
        if ($scope.drumGrid[index][tick])
            $scope.playWav(index);
    };
    
    $scope.playWav = function(index) {
        var buffer = $scope.bufferList[index];
        var filterFrequency = $scope.drumSamples[index].filterFrequency;
        var q = $scope.drumSamples[index].filterQ;
    
        var source1 = $scope.context.createBufferSource();
        source1.buffer = buffer;
        
        if (filterFrequency>0) {
            var filter = $scope.context.createBiquadFilter();
            filter.type = "lowpass"; // Low-pass filter.
            filter.frequency.value = filterFrequency; 
            
            if (q>0) {
                filter.Q.value = q;
            }
            
            source1.connect(filter);
            filter.connect($scope.context.destination);
        }
        else {
            source1.connect($scope.context.destination);
        }
        
        source1.start(0);
    };    
    
    $scope.playNote = function(index, velocity, autoNoteOff) {
    
        var n = getNoteFromKey(index);
        velocity = velocity || 127;
    
        var filter = $scope.context.createBiquadFilter();
        filter.type = "lowpass"; // Low-pass filter.
        filter.frequency.value = $scope.filterFrequency; 
        filter.Q.value = $scope.filterQ; 

        var osc = $scope.context.createOscillator(); // Create sound source
        var osc2 = $scope.context.createOscillator(); // Create sound source
        osc.type = "square";
        osc2.type = "square";
        var gain = $scope.context.createGain(); // Create gain node
        gain.gain.value = 0.3*(velocity/127);

        osc.connect(gain);
        osc2.connect(gain);
        
        gain.connect(filter); // Connect sound to output
        
        filter.connect($scope.context.destination);
        
        osc.frequency.value = calculateFrequency(n);
        osc2.frequency.value = calculateFrequency(n)*3; 
        
        osc2.detune.value = 10; // value in cents
        osc.start(0);
        osc2.start(0);
        
        // var i1 = setInterval(function(){ osc.frequency.value += 0.5;}, 10);
        
        if (autoNoteOff) {    
            stopNote(osc, osc2, gain);
        }
        else {
            var noteData = $scope.activeNotes[index];
            if (noteData) {
                delete $scope.activeNotes[index];
                stopNote(noteData.oscillator1, noteData.oscillator2, noteData.gain);
            }

            $scope.activeNotes[index] = { oscillator1: osc, oscillator2: osc2, gain: gain, filter: filter };
        }
    };    

    $scope.togglePlay = function() {
        $scope.play = !$scope.play;
        if ($scope.play) { 
            setTimeout(tick, 1);
        }
    };
                
    // utility

    $scope.isBlackKey =  function(index) {
        if (notes[index % 12].indexOf("#") > -1)
            return true;
        else
            return false;
    };
    
    $scope.isWhiteKey =  function(index) {
        return !$scope.isBlackKey(index);
    };            

    $scope.range = function(a, b, step) {
        var v= [];

        v.push(a);
        step= step || 1;
        while(a+step< b) {
            a+=step;
            v.push(a);
        }
        return v;
    };

    // private functions and properties

    var notes = ["C", "C#", "D", "D#",  "E",  "F",  "F#",  "G",  "G#", "A", "A#", "B"];        

    function bpmToMillisec(bpm) {
        return (1000*60) / (bpm*4);
    }

    function calculateFrequency(note) {
        return 440 * Math.pow(2, note/12);
    }
    
    function tick() {
        if (!$scope.play) 
            return;

        setTimeout(tick, bpmToMillisec($scope.tempo));

        for (var i=0; i<$scope.drumSamples.length; i++) {
                $scope.checkAndPlayWav(i, $scope.currentTick);
        }

        $scope.$apply(function() {
            $scope.currentTick = ($scope.currentTick + 1) % 16;            
        });
    } 
    
    function createAudioContext() {
        var contextClass = (window.AudioContext || 
          window.webkitAudioContext || 
          window.mozAudioContext || 
          window.oAudioContext || 
          window.msAudioContext);
        if (contextClass) {
            return new contextClass();
        } else {
            alert("Audio not supported.");
          return null;
        }    
    }

    function init() {
        $scope.context = createAudioContext();
        
        // wav files
        var drumSamplesFiles = $scope.drumSamples.map(function(ds) {return ds.file;});

        var bufferLoader = new BufferLoader(
            $scope.context,
            drumSamplesFiles,
            function() {
                console.log("Loading complete"); 
                $scope.bufferList = this.bufferList;
            }
        );

        bufferLoader.load();    
        
        // shortcuts

        for (var i=0; i<$scope.noteKeys.length; i++) {
            $scope.noteKeysActive.push(false);
            hotkeys.add({
                combo: $scope.noteKeys[i],
                callback: createPlayNoteFunction(i)
            });
        }
        
        // create a random pattern
        $scope.randomize();
        
        // init MIDI input devices, if present
        initMidi();
    }  
    
    function createPlayNoteFunction(index) {
        return function() {
            $scope.playNote(index, 127, true);  
            $scope.noteKeysActive[index] = true;
            setTimeout(createStopNoteFunction(index), 400);
        };
    }
    
    function createStopNoteFunction(index) {
        return function() {
            $scope.$apply(function() {$scope.noteKeysActive[index]=false;});
        };
    }
    
    function getNoteFromKey(index) {
        return index-12*4+3;
    }

    // MIDI implementation
    function initMidi() {
        if (!navigator.requestMIDIAccess) {
            console.log("No MIDI support.");
            return; // no support
        }
            
        navigator.requestMIDIAccess().then(initMidiOK, initMidiKO);
    }
        
    function initMidiOK(midi) {
        var midiAccess = midi;

        var inputs=midiAccess.inputs.values();
      
        for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
            input.value.onmidimessage = onMidiMessage;
        }
    }

    function initMidiKO() {
      console.log("Something went went wrong with MIDI initialization, I'm soooo sorry.");
    }
  
    function onMidiMessage(event) {
        // Mask off the lower nibble (MIDI channel, which we don't care about)
        switch (event.data[0] & 0xf0) {
            
            case 0x90: // note on
                if (event.data[2]!==0) {  // if velocity != 0, this is a note-on message
                    noteOn(event.data[1], event.data[2]);
                }
                break;
                
            case 0x80: // note off
                noteOff(event.data[1]);
                break;
                
            case 0xB0: // control change
                if (event.data[1]==1) // modulation wheel
                    $scope.$apply(function() {
                        $scope.filterFrequency = 200+(event.data[2]*(7000-200)/127);
                        
                        for (var note in $scope.activeNotes) {
                            if ($scope.activeNotes.hasOwnProperty(note))
                                $scope.activeNotes[note].filter.frequency.value = $scope.filterFrequency;
                        }
                    });
                break;                   
        }
    }
    
    function noteOn(note, velocity) {
        $scope.playNote(note-48, velocity, false);
    }
    
    function noteOff(note) {
        var noteData = $scope.activeNotes[note-48];
        
        if (!noteData) 
            return;
        
        delete $scope.activeNotes[note-48];
        stopNote(noteData.oscillator1, noteData.oscillator2, noteData.gain);
    }
    
    function stopNote(oscillator1, oscillator2, gain) {
        var i2 = setInterval(function(){ 
            if (gain.gain.value>0) { 
                gain.gain.value -= 0.005; 
            } 
            else { 
                gain.gain.value=0; 
                oscillator1.stop();  
                oscillator2.stop(); 
                clearInterval(i2);
            } 
        }, 5);
    }    

    // let's gooo, pink team!
    init();
});
