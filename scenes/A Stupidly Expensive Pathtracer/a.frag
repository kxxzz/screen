#define TAU 6.28318530718

#define AA 2.
#define DOF 4.

#define FAR 50.
#define ITER 80
#define STEP .8
#define NORK 1e-3

#define RITER 6
#define RRFB .001

struct obj {
    vec3 emit;
    float opaque;
    bool screen;
    vec3 tuv;
} objHit;

vec2 hash23(vec3 p3)
{
    p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}

vec3 hashHs( vec3 n, uint seed )
{
    float a=(float((seed*0x73493U)&0xfffffU)/float(0x100000))*2.-1.;
    float b=6.283*(float((seed*0xAF71fU)&0xfffffU)/float(0x100000));
    float c=sqrt(1.-a*a);
    vec3 r=vec3(c*cos(b),a,c*sin(b));
    return dot(r,n)>0.?r:-r;
}

mat3 rx(float a){ float s=sin(a), c=cos(a); return mat3(1,0,0,0,c,s,0,-s,c); }
mat3 ry(float a){ float s=sin(a), c=cos(a); return mat3(c,0,s,0,1,0,-s,0,c); }
mat3 rz(float a){ float s=sin(a), c=cos(a); return mat3(c,s,0,-s,c,0,0,0,1); }

float box(vec3 p){ p=abs(p); return max(max(p.x, p.y), p.z); }
float box(vec2 p){ p=abs(p); return max(p.x, p.y); }

float sbox(vec3 p){ return max(max(p.x, p.y), p.z); }
float sbox(vec2 p){ return max(p.x, p.y); }

bool dmin(inout float d, in float x){ bool b=x<d; if(b)d=x; return b; }


/////////////////////////////////


vec3 screen( vec2 uv, float time )
{   
    vec3  R = iResolution,
         rd = normalize(vec3(uv-.5, R.y/R.x)),
         ro = vec2(0, time).xxy;
    
    rd *= ry(.6);
    
    float t=.0, m;
    for( int i=0; ++i < 30; )
    {
        vec3 p = ro + rd * t;
        
        float s = sin( time + .6*p.z )/4.;
        p *= rz( s );
        p.xy += .5 + vec2( -s, s );

        vec3 q = abs( p-round(p) );
        float d = min(min(length(q.xy), length(q.xz)), length(q.yz)) - .01;
        d = min(d, box(q) - .05);
        q = vec3(.0, p.xy - vec2(2.5, 0.5) ) * rz( p.z + time );
        d = min(d, box(q) - .25);
        
        t += d/2.;
    }
    
    return vec3( cos(t*rd.z + time - .5),
                 exp(-t/6.),
                 1.-exp(-t/4.) );
}


/////////////////////////////////


float wall(vec3 p)
{
    float d = -p.z;
    if(d > .5)return d;
    
    p.xy = -abs(p.xy-round(p.xy));
    
    for(int tx=0; tx<2; tx++)
    {
        for(int ty=0; ty<2; ty++)
        {
            vec3 q = vec3(tx, ty, 0) + p;
            float l = length(q.xy);
            d = min(d, max(l-1., -p.z-(l*l)/8.));
        }
    }
    
    return d;
}

float map(vec3 p)
{
    objHit.emit = vec3(0);
    objHit.opaque = 1.;
    objHit.screen = false;
    
    float d = 1e+31;
    
    dmin(d, wall(p-vec3(2.5)));
    dmin(d, max(1.5+p.y, -3.-p.z));
    
    
    const float w = 2.25;
    float t = 3. * round(.5 * p.x/w);
    
    vec3 q = p;
    q.x = mod(p.x + w, 2.*w) - w;
    //q.z -= .1 * sin(t);
    
    float ratio = iResolution.x/iResolution.y;
    
    float screen = sbox(abs(q)-vec3(ratio, 1, 0)-.1);
    dmin(screen, sbox(abs(q-vec3(0, -4, .2))-vec3(-.3*p.y, 4, .2)));
    dmin(screen, sbox(abs(q*rx(-.04)-vec3(0, -1.45, -1.5))-vec3(1, .1, .6)));
    
    if(dmin(d, screen))objHit.opaque = .5;
    objHit.screen = (abs(q.z+.1) < .1) && (box(q.xy/vec2(ratio,1)) < 1.);
    //if(objHit.screen)objHit.opaque = .0;
    
    vec2 tuv = q.xy / vec2(ratio, 1);
    objHit.tuv = vec3(0.5 * tuv + 0.5, t);
    
    
    //if(dmin(d, 2.4-p.z+.02*pow(p.y-1., 2.) ))objHit.emit = vec3(2);
    if(dmin(d, 2.46-p.z))objHit.emit = vec3(2);
    
    if(dmin(d, length(p-vec3(-10, 4, -8))-5.))objHit.emit = vec3(2,1,0) * .3;
    if(dmin(d, length(p-vec3(+10, 4, -8))-5.))objHit.emit = vec3(0,1,2) * .5;
    
    if(dmin(d, length(p.yz-vec2(8, -8))-5.))objHit.emit = vec3(.5);
    
    return d;
}


/////////////////////////////////


vec3 normal(vec3 p, float k)
{
    float m = map(p);
    vec2 e = vec2(0,k);
    return normalize(m-vec3(
        map(p - e.yxx),
        map(p - e.xyx),
        map(p - e.xxy)
    ));
}

float tracer(vec3 ro, vec3 rd)
{
    float t=RRFB, m;
    for(int i=0; i < ITER; i++)
    {
        t += STEP * map(ro + rd*t);
        if(t > FAR)break;
    }
    return t;
}


/////////////////////////////////


void camera(out vec3 ro, out vec3 rd, in vec2 p)
{
    p.xy += AA * (hash23(vec3(p.xy, iFrame)) - .5);
    vec2 uv = (2.*p.xy-iResolution.xy)/iResolution.x;
    
    vec2 blur = DOF * (hash23(vec3(iFrame, p.xy))-.5) / iResolution.x;
    mat3 rm = rx(blur.x) * ry(blur.y + TAU/8.);
    
    ro = rm * vec3(-.75, -0.25, -8);
    rd = rm * normalize(vec3(uv, 2));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0);
    
    if(iFrame > 0 && texelFetch(iChannel1, ivec2(0x20, 0), 0).r < .5)
        fragColor = texelFetch(iChannel0, ivec2(fragCoord.xy), 0);
    
    uint seed = uint(fragCoord+12345.) * uint(fragCoord.y+67890.);
    
    vec3 emit = vec3(0), ro, rd, sp, sn;
    camera(ro, rd, fragCoord);
    
    for(int i=0; i<RITER; i++)
    {
        float t = tracer(ro, rd);
        if(t > FAR)break; 
        
        obj objSave = objHit;
        
        sp = ro + rd*t;
        sn = normal(sp,NORK);
        
        emit += objSave.emit;
        
        if(objSave.screen)
        {
            float time = objSave.tuv.z;
            emit = .8 * screen(objSave.tuv.xy, time);
        }
        
        seed ^= uint(iFrame) / uint(i+1);
        rd = mix(reflect(rd, sn), hashHs(sn, seed), objSave.opaque);
        ro = sp;
    }
    
    //emit = 10. * emit / (box(emit)+1.);
    //emit = pow(emit, vec3(.4545));
    
    fragColor += vec4(emit, 1);
}

