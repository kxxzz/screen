

//////////////////////////////
//   2D Ttransformations    //
//////////////////////////////
vec2 translate(vec2 p, vec2 t){ return p - t;}
vec2 scale(vec2 p, float s){ return p * mat2(s, 0, 0, s);}
vec2 rotate(vec2 p, float a){return p * mat2(cos(a), -sin(a), sin(a), cos(a));}
vec2 rotateCCW(vec2 p, float a){    return p * mat2(cos(a), sin(a), -sin(a), cos(a));}

//////////////////////////////////////
//    2D Matrix Ttransformations    //
//////////////////////////////////////
mat3 rotate(float r){float c = cos(r), s = sin(r); return mat3(c,-s,0,  s,c,0,  0,0,1);}
mat3 scale(float s){ return mat3(s,0,0, 0,s,0, 0,0,1);}
mat3 translate(vec2 p) { return mat3(1,0,p.x, 0,1,p.y, 0,0,1);}
mat3 skew(float r) { return mat3(1,tan(r),0, 0,1,0, 0,0,1);}
mat3 skewVert(float r) { return mat3(1,0,0, tan(r),1,0, 0,0,1);}
mat3 inverse2x3(mat3 m){
      float a=m[0][0], b=m[0][1], c=m[0][2], d=m[1][0], e=m[1][1], f=m[1][2], t=a*e-b*d;
      return mat3(e/t, -b/t, (f*b-c*e)/t, -d/t, a/t, (-f*a+c*d)/t, 0, 0, 1);
}
vec2 transform(vec2 p, mat3 m){ return (vec3(p,1)*m).xy;}

//////////////////////////////////////
// Combine distance field functions //
//////////////////////////////////////
float smoothMerge(float d1, float d2, float k){
    float h = clamp(0.5 + 0.5*(d2 - d1)/k, 0.0, 1.0);
    return mix(d2, d1, h) - k * h * (1.0-h);
}
float merge(float d1, float d2){
    return min(d1, d2);
}
float mergeExclude(float d1, float d2){
    return min(max(-d1, d2), max(-d2, d1));
}
float substract(float d1, float d2){
    return max(-d1, d2);
}
float intersect(float d1, float d2){
    return max(d1, d2);
}

///////////////////////
// Masks for drawing //
///////////////////////
float fillMask(float dist){
    return clamp(-dist, 0.0, 1.0);
}
float innerBorderMask(float dist, float width){
    //dist += 1.0;
    float alpha1 = clamp(dist + width, 0.0, 1.0);
    float alpha2 = clamp(dist, 0.0, 1.0);
    return alpha1 - alpha2;
}
float outerBorderMask(float dist, float width){
    dist += 1.0;
    float alpha1 = clamp(dist, 0.0, 1.0);
    float alpha2 = clamp(dist - width, 0.0, 1.0);
    return alpha1 - alpha2;
}


//////////////////////////////
// Distance field functions //
//////////////////////////////
float dfRoundedBox(vec2 p, vec2 size, float radius){
    size -= vec2(radius);
    vec2 d = abs(p) - size;
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - radius;
}
float dfCircle(vec2 p, float radius){   
    return length(p) - radius;
}

vec4 visualizeDFScroll( float d, float step, float linewidth){     
   float wave = max(.0, -abs( mod( d - iTime * 15. , step ) - step/2.0 ) * 2./linewidth +1.);    
   float tolerance = 1. / (linewidth * 8.) + .05;
   vec4 res = vec4(1.0, 0.6, 0.3, smoothstep(.0, tolerance, wave));    
   if(sign(d) < 1.){ res.rgb =vec3(0.6, 0.8, 1.0);}      
   return res;
}

//////////////////////////////
//   Grid                   //
//////////////////////////////
float grid(float s, vec2 p, float zoom){
   float size = s * pow(2.0, floor(log2(zoom)));
   p = mod(p/zoom, size/zoom);
   if(min(p.x,p.y) < 1.0 ) return 0.9;
   return 1.;
}



//////////////////////////////
//   Read UI State          //
//////////////////////////////
float readFloat(float address) { return texture(iChannel0, (floor(vec2(address, 1))+0.5) / iChannelResolution[0].xy).r; }
vec4 readVec4(vec2 address) { return texture(iChannel0, (floor(address)+0.5) / iChannelResolution[0].xy); }

//////////////////////////////
//   Blending               //
//////////////////////////////

vec4 alphaBlendOpaque(vec4 src, vec4 target, float opacity){
    if(opacity < 1.0) src.a *= opacity;
    return vec4(src.rgb*src.a + target.rgb*(1.- src.a), 1);
}


/////////////////////////////
// The scene               //
/////////////////////////////

float scene(vec2 p){
    
    float r3 = readFloat(3.);
    float r4 = readFloat(4.) * (sin(iTime*7.5)+.5)/2.+.2;;
    float r5 = readFloat(5.);    
    float r6 = (sin(iTime*2.)+1.)/5.3+1.0;
    
    float b = dfRoundedBox(translate(p, vec2(0, -50)), vec2(100.*r6, 100.*r4), 100.*min(r6,r4)*r5);
    b=merge(b, dfRoundedBox(translate(p, vec2(70, 80)), vec2(40.*r3,40), 30.*r5 ));
    b=merge(b, dfRoundedBox(translate(p, vec2(-70, 80)), vec2(40.*r3,40), 30.*r5 ));
    
    return b;
}

//////////////////////////////////////////


void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    
    ///////////////// calculate /////////////////
    
    
    float r1 = readFloat(1.);
    float r2 = readFloat(2.);
    
    float zoom = 4.0 * (r2+.025);
    
    //viewport transformation matrix 
    mat3 screenToView = translate(-iResolution.xy / 2.0)*scale(zoom);    
    screenToView *= rotate((r1-.5)*3.14);
    
    vec2 p = transform(fragCoord.xy, screenToView);  //viewport pixel position
    vec2 m = transform(iMouse.xy, screenToView); //viewport mouse position 
    
    float d = scene(p);// distance field
    
    
    ///////////////// output /////////////////
    
    // background     
    //vec4 col = vec4(0.4, 0.4, 0.4, 1.0);
    vec4 col = vec4(0.5, 0.5, 0.5, 1.0) * (1.0 - length(iResolution.xy/2.0 - fragCoord.xy)/iResolution.x); //gradient
    col *= grid(20.0, p, zoom); //grid1
    col *= grid(100.0, p, zoom); //grid2
    
    
    // scene   
    col = mix(col, vec4(.2, 0.3, 0.4, 1.0), fillMask(d));
    
    // Visualize the distance field 
    col = alphaBlendOpaque(visualizeDFScroll(d, 15.0, 2.), col, .3 * readFloat(6.));
    
    col = clamp(col, 0.0, 1.0);
    
    //UI
    vec4 ui = texture(iChannel0, fragCoord/iResolution.xy);
    col = mix(col, ui, ui.a);
    
    fragColor = col;
}





