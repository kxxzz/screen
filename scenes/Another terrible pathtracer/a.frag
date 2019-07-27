#define TAU 6.28318530718

#define AA 1.
#define DOF 24.

#define FAR 12.
#define ITER 90
#define NORK 5e-4

#define RITER 6
#define RRFB .001

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

vec2 amod(vec2 p, float m)
{
    float a=mod(atan(p.x, p.y), m) - m/2.;
    return vec2(cos(a),sin(a)) * length(p);
}

void dmin(inout vec3 d, in float x, in float y, in float z)
{
    if(x < d.x) d = vec3(x,y,z);
}

vec3 map(vec3 p)
{
    vec3 d = vec2(0, 1e+31).yxx;
    
    dmin(d, .75-abs(p.y), 1., 0.);
    dmin(d, length(p)-.5, 0., 0.);
    
    if(length(p.xz) > 10.)return d;
    
    vec3 q = abs(p-round(p-.5)-.5);
    float g = min(min(box(q.xy), box(q.xz)),box(q.yz))-.05;
    float c = min(.6-abs(p.x+p.z), .45-abs(p.y));
    dmin(d, max(g, c), .1, 0.);
    
    dmin(d, box(p.xz-2.)-.5, 8., -.5);
    dmin(d, box(p.xz+2.)-.5, 8., +.5);
    
    return d;
}

vec3 normal(vec3 p, float k)
{
    float m = map(p).x;
    vec2 e = vec2(0,k);
    return normalize(m-vec3(
        map(p - e.yxx).x,
        map(p - e.xyx).x,
        map(p - e.xxy).x
    ));
}

vec3 tracer(vec3 ro, vec3 rd)
{    
    vec3 m;
    float t=RRFB;
    for(int i=0; i < ITER; i++)
    {
        m = map(ro + rd*t);
        if(t > FAR)break;
        t += m.x; 
    }
    return vec3(t, m.yz);
}

void camera(out vec3 ro, out vec3 rd, in vec2 p)
{
    p.xy += AA * (hash23(vec3(p.xy, iFrame)) - .5);
    vec2 uv = (2.*p.xy-iResolution.xy)/iResolution.x;
    vec2 blur = DOF * (hash23(vec3(iFrame, p.xy))-.5) / iResolution.x;
    mat3 rm = ry(TAU/8. + blur.x) * rx(blur.y);
    ro = rm * vec2(0, -3).xxy;
    rd = rm * normalize(vec3(uv, 1));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0);
    
    if(iFrame > 0 && texelFetch(iChannel1, ivec2(0x20, 0), 0).r < .5)
        fragColor = texelFetch(iChannel0, ivec2(fragCoord.xy), 0);
    
    uvec2 temp = uvec2(fragCoord + 12345.);
    uint seed = temp.x * temp.y;
    
    vec3 emit = vec3(0), ro, rd, t, sp, sn;
    camera(ro, rd, fragCoord);
    
    for(int i=0; i<RITER; i++)
    {
        t = tracer(ro, rd);
        if(t.x > FAR)break;
        
        sp = ro + rd*t.x;
        sn = normal(sp,NORK);
        
        if(t.y > 1.)emit += 0.5 * t.y * vec3(1.+t.z, 1, 1.-t.z);
        
        seed ^= uint(iFrame) / uint(i+1);
        rd = mix(reflect(rd, sn), hashHs(sn, seed), t.y);
        ro = sp;
    }
    
    emit = 10. * emit / (box(emit)+1.);
    emit = pow(emit, vec3(.4545));
    
    fragColor += vec4(emit, 1);
}

