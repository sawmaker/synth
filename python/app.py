"""VOLTA·24 desktop synthesizer. Run with python app.py."""
import sys, time, random, math
try:
    import tkinter as tk
    from tkinter import ttk, messagebox
except ImportError:
    sys.exit('Tkinter is required. Install your system Python Tk package (for example python3-tk).')
try:
    import numpy as np
    from engine import SynthEngine, PRESETS
    from theory import CHORDS, KEY_MAP, KEY_LABEL, note_name
except ImportError as exc:
    sys.exit(f'Missing dependency: {exc}. Install with pip install -r requirements.txt')

BG='#111419'; PANEL='#1a1e24'; TEXT='#e8e5d9'; MUTED='#92999f'; AMBER='#ff9c2b'; CYAN='#2ee6d6'
DIVS={'1/4':1, '1/8':.5, '1/8T':1/3, '1/16':.25, '1/32':.125}
class App:
    def __init__(self, root):
        self.root=root; root.title('VOLTA·24 — Python Synthesizer'); root.configure(bg=BG); root.geometry('1450x950')
        self.engine=SynthEngine(); self.vars={}; self.keys={}; self.gates={}; self.latched=set(); self.mouse_note=None; self.octave=4
        self.hold=tk.BooleanVar(value=False); self.chord_mode=tk.BooleanVar(value=False); self.chord=tk.StringVar(value='MIN7'); self.arp=tk.BooleanVar(value=False); self.demo=tk.BooleanVar(value=False); self.div=tk.StringVar(value='1/8'); self.pattern=tk.StringVar(value='up'); self.step=0; self.next_step=0; self.next_demo=0; self.demo_index=-1; self.scheduled=[]
        self.build(); root.bind_all('<KeyPress>',self.key_down); root.bind_all('<KeyRelease>',self.key_up); root.protocol('WM_DELETE_WINDOW',self.close)
        self.tick(); self.draw_scope()
    def label(self,parent,text,**kw): return tk.Label(parent,text=text,bg=kw.pop('bg',PANEL),fg=kw.pop('fg',TEXT),font=kw.pop('font',('Arial',10)),**kw)
    def button(self,parent,text,command,**kw): return tk.Button(parent,text=text,command=command,bg='#303640',fg=TEXT,activebackground=AMBER,activeforeground=BG,relief='flat',**kw)
    def panel(self,parent,title):
        f=tk.LabelFrame(parent,text='  '+title+'  ',bg=PANEL,fg=AMBER,font=('Arial',10,'bold'),padx=8,pady=6,bd=1); return f
    def build(self):
        header=tk.Frame(self.root,bg=BG); header.pack(fill='x',padx=14,pady=8)
        self.label(header,'VOLTA·24',bg=BG,fg=AMBER,font=('Arial',24,'bold')).pack(side='left'); self.label(header,'  POLYPHONIC SYNTHESIZER / PYTHON',bg=BG,fg=MUTED).pack(side='left')
        self.status=self.label(header,'AUDIO OFF',bg=BG,fg=CYAN); self.status.pack(side='right'); self.button(header,'START AUDIO',self.start_audio).pack(side='right',padx=8); self.button(header,'PANIC',self.panic).pack(side='right')
        main=tk.Frame(self.root,bg=BG); main.pack(fill='both',expand=True,padx=12)
        top=tk.Frame(main,bg=BG); top.pack(fill='x')
        preset=self.panel(top,'01 / PRESETS'); preset.pack(side='left',fill='both',expand=True,padx=3)
        self.preset_var=tk.StringVar(value=PRESETS[0]['name']); menu=ttk.Combobox(preset,textvariable=self.preset_var,values=[p['name'] for p in PRESETS],state='readonly',width=22); menu.pack(side='left'); menu.bind('<<ComboboxSelected>>',self.load_preset)
        self.label(preset,'  16 VOICES  ·  STEREO ENGINE',fg=MUTED).pack(side='left')
        self.scope=tk.Canvas(top,width=430,height=100,bg='#0c1014',highlightthickness=1,highlightbackground='#323b40'); self.scope.pack(side='right',padx=3)
        self.meter=self.label(preset,'LEVEL  0%',fg=CYAN); self.meter.pack(side='right')
        row=tk.Frame(main,bg=BG); row.pack(fill='x',pady=5)
        osc=self.panel(row,'02 / OSCILLATOR BANK'); osc.pack(side='left',fill='both',expand=True,padx=3)
        self.choice(osc,'WAVE','waveform',['sine','triangle','sawtooth','square']); self.sliders(osc,[('OCT','octave',-2,2,1),('DETUNE','detune',-100,100,1),('UNISON','unison',1,5,1),('SPREAD','spread',0,50,1),('SUB','sub',0,1,.01),('GLIDE','glide',0,1,.01)])
        filt=self.panel(row,'03 / LOW-PASS FILTER'); filt.pack(side='left',fill='both',expand=True,padx=3)
        self.choice(filt,'SLOPE','slope',[12,24]); self.sliders(filt,[('CUTOFF','cutoff',20,18000,10),('RESONANCE','resonance',.1,20,.1),('ENV AMT','filterEnv',-1,1,.01),('KEY TRACK','keyTrack',0,1,.01)])
        row2=tk.Frame(main,bg=BG); row2.pack(fill='x',pady=5)
        env=self.panel(row2,'04 / AMPLITUDE ENVELOPE'); env.pack(side='left',fill='both',expand=True,padx=3)
        self.sliders(env,[('ATTACK','attack',.002,4,.002),('DECAY','decay',.01,4,.01),('SUSTAIN','sustain',0,1,.01),('RELEASE','release',.01,5,.01)])
        fx=self.panel(row2,'05 / MODULATION & FX'); fx.pack(side='left',fill='both',expand=True,padx=3)
        self.sliders(fx,[('LFO RATE','lfoRate',.05,12,.05),('LFO DEPTH','lfoDepth',0,1,.01),('DRIVE','drive',0,1,.01),('DELAY MIX','delayMix',0,1,.01),('DELAY TIME','delayTime',.02,1,.01),('FEEDBACK','delayFb',0,.9,.01),('REVERB','reverbMix',0,1,.01)])
        master=self.panel(row2,'06 / MASTER'); master.pack(side='left',fill='both',expand=True,padx=3); self.sliders(master,[('LEVEL','master',0,1,.01)])
        limiter=tk.BooleanVar(value=self.engine.params['limiter']); self.vars['limiter']=limiter; tk.Checkbutton(master,text='LIMITER',variable=limiter,command=lambda:self.engine.set_param('limiter',limiter.get()),bg=PANEL,fg=TEXT,selectcolor=BG).pack()
        cp=self.panel(main,'07 / CHORDS & ARPEGGIATOR'); cp.pack(fill='x',padx=3,pady=4)
        controls=tk.Frame(cp,bg=PANEL); controls.pack(fill='x')
        for text,var,cmd in [('CHORD KEYS',self.chord_mode,None),('HOLD / LATCH',self.hold,self.hold_change),('ARP',self.arp,self.arp_change),('DEMO',self.demo,self.demo_change)]: tk.Checkbutton(controls,text=text,variable=var,command=cmd,bg=PANEL,fg=TEXT,selectcolor=BG,activebackground=PANEL,activeforeground=TEXT).pack(side='left')
        ttk.Combobox(controls,textvariable=self.chord,values=list(CHORDS),state='readonly',width=8).pack(side='left',padx=4)
        ttk.Combobox(controls,textvariable=self.div,values=list(DIVS),state='readonly',width=6).pack(side='left',padx=4)
        ttk.Combobox(controls,textvariable=self.pattern,values=['up','down','updown','random','chord'],state='readonly',width=8).pack(side='left',padx=4)
        pads=tk.Frame(cp,bg=PANEL); pads.pack(fill='x',pady=4)
        for shape in CHORDS:
            b=self.button(pads,shape,lambda:None); b.pack(side='left',expand=True,fill='x',padx=1); b.bind('<ButtonPress-1>',lambda e,s=shape:self.pad_down(s)); b.bind('<ButtonRelease-1>',lambda e:self.pad_up())
        kb=self.panel(main,'08 / KEYBOARD'); kb.pack(fill='both',expand=True,padx=3,pady=4)
        bar=tk.Frame(kb,bg=PANEL); bar.pack(fill='x'); self.button(bar,'− OCT',lambda:self.change_octave(-1)).pack(side='left'); self.oct_label=self.label(bar,'OCTAVE 4',fg=CYAN); self.oct_label.pack(side='left',padx=8); self.button(bar,'+ OCT',lambda:self.change_octave(1)).pack(side='left'); self.label(bar,'QWERTY TO PLAY  ·  SPACE HOLD  ·  SHIFT PEDAL  ·  ARROWS OCTAVE  ·  ESC PANIC',fg=MUTED).pack(side='right')
        self.keyboard=tk.Canvas(kb,bg=BG,height=140,highlightthickness=0); self.keyboard.pack(fill='both',expand=True,pady=5); self.keyboard.bind('<Configure>',lambda e:self.draw_keyboard()); self.keyboard.bind('<ButtonPress-1>',self.mouse_down); self.keyboard.bind('<ButtonRelease-1>',self.mouse_up)
    def sliders(self,parent,items):
        f=tk.Frame(parent,bg=PANEL); f.pack(fill='both',expand=True)
        for i,(label,key,lo,hi,step) in enumerate(items):
            col=tk.Frame(f,bg=PANEL); col.pack(side='left',fill='both',expand=True)
            var=tk.DoubleVar(value=self.engine.params[key]); self.vars[key]=var
            self.label(col,label,fg=MUTED,font=('Arial',8)).pack(); tk.Scale(col,from_=hi,to=lo,resolution=step,variable=var,command=lambda value,k=key:self.engine.set_param(k,float(value)),length=85,width=12,bg=PANEL,fg=TEXT,troughcolor='#343d45',highlightthickness=0,font=('Arial',8)).pack()
    def choice(self,parent,label,key,values):
        f=tk.Frame(parent,bg=PANEL); f.pack(fill='x'); self.label(f,label,fg=MUTED).pack(side='left'); var=tk.StringVar(value=str(self.engine.params[key])); self.vars[key]=var
        box=ttk.Combobox(f,textvariable=var,values=values,state='readonly',width=12); box.pack(side='left',padx=5); box.bind('<<ComboboxSelected>>',lambda e:self.engine.set_param(key,int(var.get()) if key=='slope' else var.get()))
    def load_preset(self,event=None):
        index=next(i for i,p in enumerate(PRESETS) if p['name']==self.preset_var.get()); self.engine.preset(index)
        for key,var in self.vars.items(): var.set(self.engine.params[key])
    def start_audio(self):
        try: self.engine.start(); self.status.config(text='AUDIO ON')
        except Exception as e: messagebox.showerror('Audio unavailable',f'Could not start audio:\n{e}\n\nInstall PortAudio and select a working output device.'); self.status.config(text='AUDIO OFF')
    def notes_for(self,note): return [note+i for i in CHORDS[self.chord.get()]] if self.chord_mode.get() else [note]
    def press(self,source,notes):
        if source in self.gates: return
        already=set(self.pool()); self.gates[source]=notes
        for n in notes:
            if self.hold.get(): self.latched.add(n)
            if n not in already and not self.arp.get() and not self.demo.get(): self.engine.note_on(n)
        self.draw_keyboard()
    def release(self,source):
        notes=self.gates.pop(source,[])
        if not self.hold.get() and not self.arp.get() and not self.demo.get():
            active={n for ns in self.gates.values() for n in ns}
            for n in notes:
                if n not in active: self.engine.note_off(n)
        self.draw_keyboard()
    def hold_change(self):
        if not self.hold.get():
            active={n for ns in self.gates.values() for n in ns}
            for n in self.latched-active: self.engine.note_off(n)
            self.latched.clear()
        self.draw_keyboard()
    def arp_change(self):
        self.engine.panic(); self.scheduled.clear(); self.next_step=0
        if not self.arp.get():
            for n in self.pool(): self.engine.note_on(n)
    def demo_change(self):
        self.engine.panic(); self.scheduled.clear(); self.next_demo=0; self.demo_index=-1; self.demo_notes=[]
    def pool(self): return sorted({n for ns in self.gates.values() for n in ns}|self.latched)
    def tick(self):
        now=time.monotonic()
        if self.demo.get() and now>=self.next_demo:
            progression=[(57,(0,3,7,10)),(53,(0,4,7,11)),(60,(0,4,7,11,14)),(55,(0,4,7,9))]; self.demo_index=(self.demo_index+1)%4; root,intervals=progression[self.demo_index]; self.demo_notes=[root+i for i in intervals]; self.next_demo=now+8*60/104
        for due,n in self.scheduled[:]:
            if now>=due: self.engine.note_off(n); self.scheduled.remove((due,n))
        notes=self.demo_notes if self.demo.get() else self.pool()
        if (self.arp.get() or self.demo.get()) and notes and now>=self.next_step:
            duration=60/104*DIVS[self.div.get()]; pattern=self.pattern.get(); count=len(notes); idx=self.step%max(1,2*count-2)
            selected=notes if pattern=='chord' else [random.choice(notes) if pattern=='random' else notes[-1-self.step%count] if pattern=='down' else notes[idx if idx<count else 2*count-2-idx] if pattern=='updown' else notes[self.step%count]]
            for n in selected: self.engine.note_on(n); self.scheduled.append((now+max(.045,duration*.62),n))
            self.step+=1; self.next_step=now+duration
        self.root.after(25,self.tick)
    def key_down(self,e):
        if isinstance(e.widget,(ttk.Combobox,tk.Entry)): return
        k=e.keysym.lower()
        if k in KEY_MAP: self.press('key:'+k,self.notes_for(self.octave*12+12+KEY_MAP[k]))
        elif k=='escape': self.panic()
        elif k=='space' and 'space' not in self.keys: self.keys['space']=True; self.hold.set(not self.hold.get()); self.hold_change()
        elif k in ('shift_l','shift_r') and k not in self.keys: self.keys[k]=True; self.pedal_previous=self.hold.get(); self.hold.set(True)
        elif k in ('left','right') and k not in self.keys: self.keys[k]=True; self.change_octave(-1 if k=='left' else 1)
    def key_up(self,e):
        k=e.keysym.lower(); self.keys.pop(k,None)
        if k in KEY_MAP: self.release('key:'+k)
        elif k in ('shift_l','shift_r') and hasattr(self,'pedal_previous'): self.hold.set(self.pedal_previous); self.hold_change()
    def change_octave(self,d): self.octave=max(1,min(7,self.octave+d)); self.oct_label.config(text=f'OCTAVE {self.octave}'); self.draw_keyboard()
    def pad_down(self,shape): self.press('pad',[self.octave*12+12+i for i in CHORDS[shape]])
    def pad_up(self): self.release('pad')
    def draw_keyboard(self):
        if not hasattr(self,'keyboard'): return
        c=self.keyboard; c.delete('all'); w=max(1,c.winfo_width()); h=max(100,c.winfo_height()); white=[i for i in range(25) if i%12 not in (1,3,6,8,10)]; width=w/len(white); self.key_rects=[]; active=set(self.pool())
        for j,i in enumerate(white):
            x=j*width; note=self.octave*12+12+i; c.create_rectangle(x,0,x+width-1,h,fill=CYAN if note in active else '#e3e4dc',outline=BG); c.create_text(x+width/2,h-20,text=KEY_LABEL[i],fill='#333'); self.key_rects.append((x,0,x+width,h,note))
        for i in range(25):
            if i%12 not in (1,3,6,8,10): continue
            x=sum(j<i for j in white)*width-width*.32; note=self.octave*12+12+i; c.create_rectangle(x,0,x+width*.64,h*.62,fill=AMBER if note in active else '#252a30',outline=BG); c.create_text(x+width*.32,h*.48,text=KEY_LABEL[i],fill=TEXT); self.key_rects.append((x,0,x+width*.64,h*.62,note))
    def mouse_down(self,e):
        for x,y,x2,y2,n in reversed(self.key_rects):
            if x<=e.x<=x2 and y<=e.y<=y2: self.press('mouse',self.notes_for(n)); break
    def mouse_up(self,e): self.release('mouse')
    def draw_scope(self):
        c=self.scope; c.delete('all'); w=int(c['width']); h=int(c['height']); data=self.engine.latest.mean(axis=1); c.create_line(0,h/2,w,h/2,fill='#28343a')
        if len(data)>1:
            indices=np.linspace(0,len(data)-1,w).astype(int); points=[v for x,i in enumerate(indices) for v in (x,h*.25-data[i]*h*.23)]; c.create_line(*points,fill=CYAN)
            spectrum=np.abs(np.fft.rfft(data)); spectrum=np.log1p(spectrum); spectrum=spectrum/(max(1.,float(spectrum.max()))); count=min(100,len(spectrum));
            for i in range(count): c.create_line(i*w/count,h,i*w/count,h-spectrum[i]*h*.4,fill=AMBER)
        self.meter.config(text=f'LEVEL  {self.engine.level*100:.0f}%'); self.root.after(80,self.draw_scope)
    def panic(self): self.engine.panic(); self.gates.clear(); self.latched.clear(); self.scheduled.clear(); self.draw_keyboard()
    def close(self): self.engine.close(); self.root.destroy()
if __name__=='__main__':
    root=tk.Tk(); App(root); root.mainloop()
