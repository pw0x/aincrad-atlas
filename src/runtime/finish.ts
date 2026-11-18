import {
  DepthTexture, FloatType, HalfFloatType, Mesh, NoBlending, OrthographicCamera, PlaneGeometry,
  Scene, ShaderMaterial, UnsignedByteType, Vector2, WebGLRenderTarget
} from 'three'
import type { PerspectiveCamera, WebGLRenderer } from 'three'

// The full-resolution colour target and its resolved depth are reused for a
// short-range contact pass. The lake's mirror never enters the post chain.
export function createFinish(renderer: WebGLRenderer, camera: PerspectiveCamera, castle: boolean) {
  const hdr = renderer.extensions.has('EXT_color_buffer_float')
  const gl = renderer.getContext() as WebGL2RenderingContext
  const supported: number[] = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, hdr ? gl.RGBA16F : gl.RGBA8, gl.SAMPLES) || [])
  const depthSupported: number[] = Array.from(gl.getInternalformatParameter(gl.RENDERBUFFER, gl.DEPTH_COMPONENT32F, gl.SAMPLES) || [])
  const samples = [4,2].find(n => supported.includes(n) && depthSupported.includes(n)) ?? 0
  const target = new WebGLRenderTarget(1,1,{
    type: hdr ? HalfFloatType : UnsignedByteType, samples,
    depthTexture: new DepthTexture(1,1,FloatType)
  })
  const uniforms = {
    colorTex:{value:target.texture}, depthTex:{value:target.depthTexture}, pixel:{value:new Vector2(1,1)},
    focal:{value:new Vector2()}, nearZ:{value:camera.near}, farZ:{value:camera.far},
    radius:{value:castle?72:.22}, strength:{value:castle?.77:.92},
    focus:{value:1}, aperture:{value:0}
  }
  const material = new ShaderMaterial({
    uniforms, depthWrite:false, depthTest:false, blending:NoBlending,
    vertexShader:`varying vec2 texUV;
      void main(){ texUV=uv; gl_Position=vec4(position.xy,0.,1.); }`,
    fragmentShader:`
      uniform sampler2D colorTex,depthTex;
      uniform vec2 pixel,focal;
      uniform float nearZ,farZ,radius,strength,focus,aperture;
      varying vec2 texUV;
      vec3 viewPoint(vec2 uv,float d){
        float z=nearZ*farZ/(farZ+(nearZ-farZ)*d);
        return vec3((uv*2.-1.)*z/focal,-z);
      }
      void main(){
        vec3 base=texture2D(colorTex,texUV).rgb;
        float depth=texture2D(depthTex,texUV).r;
        vec3 p=viewPoint(texUV,depth);
        vec3 normalVector=cross(dFdx(p),dFdy(p));
        float radiusPixels=radius*focal.y/(2.*max(-p.z,.001)*pixel.y);
        if(depth<1. && radiusPixels>2. && dot(normalVector,normalVector)>1.e-18){
          vec3 n=normalize(normalVector);
          vec2 offset=clamp(radius*focal/(2.*max(-p.z,.001)),pixel*1.6,pixel*64.);
          float obscured=0.;
          for(int i=0;i<12;i++){
            float sampleIndex=float(i)+.5;
            float angle=2.39996323*sampleIndex;
            vec2 at=clamp(texUV+vec2(cos(angle),sin(angle))*sqrt(sampleIndex/12.)*offset,pixel*.5,1.-pixel*.5);
            vec3 delta=viewPoint(at,texture2D(depthTex,at).r)-p;
            float distanceToPoint=length(delta);
            float facing=max(0.,dot(n,delta)/max(distanceToPoint,.00001)-.08);
            obscured+=facing*(1.-smoothstep(radius*.09,radius,distanceToPoint));
          }
          base*=1.-clamp(obscured*strength/8.,0.,.42)*smoothstep(2.,6.,radiusPixels);
        }
        if(aperture>0.){
          // Circle of confusion on a 24 mm film height, converted to pixels.
          float f=.012*focal.y;
          float z=max(-p.z,.001);
          float coc=min(16.,abs(f*f*(z-focus)/(aperture*z*max(.005,focus-f)))/(.048*pixel.y));
          if(coc>.8){
            vec3 sum=base;
            float count=1.;
            for(int i=0;i<18;i++){
              float k=float(i)+.5;
              float a=k*2.39996323;
              vec2 at=clamp(texUV+vec2(cos(a),sin(a))*sqrt(k/18.)*pixel*coc,pixel*.5,1.-pixel*.5);
              float sampleZ=-viewPoint(at,texture2D(depthTex,at).r).z;
              float w=1.-smoothstep(z*.05,z*.25,sampleZ-z);
              sum+=texture2D(colorTex,at).rgb*w;
              count+=w;
            }
            base=mix(base,sum/count,smoothstep(.8,2.,coc));
          }
        }
        gl_FragColor=vec4(base,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  })
  const quadGeometry = new PlaneGeometry(2,2)
  const screen = new Scene()
  screen.add(new Mesh(quadGeometry,material))
  const quadCamera = new OrthographicCamera(-1,1,1,-1,0,1)
  const bufferSize = new Vector2()
  return {
    size() {
      renderer.getDrawingBufferSize(bufferSize)
      if (bufferSize.x !== target.width || bufferSize.y !== target.height) target.setSize(bufferSize.x,bufferSize.y)
      uniforms.pixel.value.set(1/target.width,1/target.height)
    },
    setAperture(value: number) { uniforms.aperture.value=value },
    focus(distance: number) { uniforms.focus.value=distance },
    draw(scene: Scene) {
      uniforms.nearZ.value=camera.near; uniforms.farZ.value=camera.far
      uniforms.focal.value.set(camera.projectionMatrix.elements[0],camera.projectionMatrix.elements[5])
      renderer.setRenderTarget(target)
      renderer.render(scene,camera)
      renderer.setRenderTarget(null)
      renderer.render(screen,quadCamera)
    },
    dispose() { target.dispose(); material.dispose(); quadGeometry.dispose() }
  }
}
