/* Small WebGL box renderer: real perspective / orthographic 3D, local only. */
window.Block3D=(()=>{
 const norm=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
 function multiply(a,b){const c=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)c[i*4+j]+=a[k*4+j]*b[i*4+k];return c;}
 function view(eye,target){const z=norm(eye.map((x,i)=>x-target[i])),x=norm(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
 function perspective(fov,aspect,n=.1,f=180){const s=1/Math.tan(fov/2);return new Float32Array([s/aspect,0,0,0,0,s,0,0,0,0,(f+n)/(n-f),-1,0,0,2*f*n/(n-f),0]);}
 function ortho(size,aspect){const h=size,w=h*aspect,n=.1,f=180;return new Float32Array([1/w,0,0,0,0,1/h,0,0,0,0,-2/(f-n),0,0,0,-(f+n)/(f-n),1]);}
 const palette=new Map();
 const color=c=>{if(typeof c!=='string')return c;if(!palette.has(c))palette.set(c,[parseInt(c.slice(1,3),16)/255,parseInt(c.slice(3,5),16)/255,parseInt(c.slice(5,7),16)/255]);return palette.get(c);};
 class Renderer{
 constructor(canvas){this.canvas=canvas;this.model=new Float32Array(16);const gl=this.gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});if(!gl)throw Error('이 브라우저에서 WebGL을 사용할 수 없어요. Chrome 또는 Edge의 그래픽 가속을 확인해 주세요.');
 const vs='attribute vec3 aPos;attribute vec3 aNormal;uniform mat4 uVP;uniform mat4 uModel;uniform vec3 uColor;uniform vec3 uEye;varying vec3 vColor;varying float vDist;void main(){vec4 p=uModel*vec4(aPos,1.);vec3 n=normalize(mat3(uModel)*aNormal);float light=.52+.48*max(0.,dot(n,normalize(vec3(-.5,1.,.6))));vColor=uColor*light;vDist=distance(p.xyz,uEye);gl_Position=uVP*p;}';
 const fs='precision mediump float;varying vec3 vColor;varying float vDist;uniform vec3 uFog;uniform float uFogStart;uniform float uFogEnd;void main(){float fog=smoothstep(uFogStart,uFogEnd,vDist);gl_FragColor=vec4(mix(vColor,uFog,fog),1.);}';
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const p=this.program=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,vs));gl.attachShader(p,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));gl.useProgram(p);
 this.uniforms={};for(const key of ['VP','Model','Color','Eye','Fog','FogStart','FogEnd'])this.uniforms[key]=gl.getUniformLocation(p,'u'+key);
 const vertices=[];const faces=[[[0,0,1],[[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]]],[[0,0,-1],[[1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1]]],[[1,0,0],[[1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1]]],[[-1,0,0],[[-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1]]],[[0,1,0],[[-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1]]],[[0,-1,0],[[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1]]]];
 for(const[n,quad]of faces)for(const index of [0,1,2,0,2,3])vertices.push(...quad[index].map(v=>v*.5),...n);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);for(const [name,offset]of [['aPos',0],['aNormal',12]]){const a=gl.getAttribLocation(p,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,24,offset);}gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);
 }
 begin({eye,target,background='#a7cbd6',fov=1,orthoSize=0,fogStart=40,fogEnd=100}){const gl=this.gl;Arcade.fit(this.canvas);gl.viewport(0,0,this.canvas.width,this.canvas.height);const c=color(background);gl.clearColor(...c,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);const projection=orthoSize?ortho(orthoSize,this.canvas.width/this.canvas.height):perspective(fov,this.canvas.width/this.canvas.height);gl.uniformMatrix4fv(this.uniforms.VP,false,multiply(projection,view(eye,target)));gl.uniform3fv(this.uniforms.Eye,eye);gl.uniform3fv(this.uniforms.Fog,c);gl.uniform1f(this.uniforms.FogStart,fogStart);gl.uniform1f(this.uniforms.FogEnd,fogEnd);}
 box(x,y,z,w,h,d,c,angle=0){const gl=this.gl,co=Math.cos(angle),si=Math.sin(angle),m=this.model;m[0]=co*w;m[2]=-si*w;m[5]=h;m[8]=si*d;m[10]=co*d;m[12]=x;m[13]=y;m[14]=z;m[15]=1;gl.uniformMatrix4fv(this.uniforms.Model,false,m);gl.uniform3fv(this.uniforms.Color,color(c));gl.drawArrays(gl.TRIANGLES,0,36);}
 }
 return{Renderer,multiply,view,perspective};
})();
