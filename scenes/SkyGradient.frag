// Sky Gradient by Hazel Quantock
#define sphere false
#define ground false


// quick and pretty sky colour
vec3 SkyColour( vec3 ray )
{
    return exp2(-ray.y/vec3(.1,.3,.6)); // blue
//    return exp2(-ray.y/vec3(.18,.2,.28))*vec3(1,.95,.8); // overcast
//    return exp2(-ray.y/vec3(.1,.2,.8))*vec3(1,.75,.5); // dusk
//    return exp2(-ray.y/vec3(.03,.2,.9)); // tropical blue
//    return exp2(-ray.y/vec3(.4,.06,.01)); // orange-red
//    return exp2(-ray.y/vec3(.1,.2,.01)); // green
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 ray;
    ray.xy = (fragCoord - iResolution.xy*.5)/iResolution.y;
    ray.z = .7;
    ray.z -= dot(ray.xy,ray.xy)*.5; // fisheye lens
    ray = normalize(ray);
    
    // tilt upwards
    vec3 k = normalize(vec3(0,sphere?-.5:.8,1));
    vec3 i = normalize(cross(vec3(0,1,0),k));
    vec3 j = cross(k,i);
    ray = ray.x*i+ray.y*j+ray.z*k;
    
    if ( sphere )
    {
        // reflect ray off sphere
        vec3 c = k*1.8;
        float t = dot(c,ray);
        float t2 = sqrt(dot(c,c)-t*t);
        if ( t2 < 1. )
        {
            t -= sqrt(1.-t2*t2);
            vec3 n = ray*t-c;
            ray = reflect(ray,n);
        }
    }
    
    vec3 tint = vec3(1);
    if ( ground && ray.y < .0 )
    {
        ray.y = -ray.y;
        tint = mix( vec3(.2), tint, pow(1.-ray.y,10.) );
    }

    fragColor.rgb = SkyColour( ray )*tint;

    // signature
    //#define L(m,n,u,v,l,f) min(f,max(abs(dot(fragCoord-vec2(m,n),vec2(u,v)))-l,abs(dot(fragCoord-vec2(m,n),vec2(-v,u)))-1.))
    //float sig=L(3,7,0,1,3.5,L(7,7,0,1,3.5,L(5,7,1,0,2.,L(14.5,5,.7071,-.7071,2.5,abs(length(fragCoord-vec2(12.7,7))-3.)-1.))));
    fragColor.rgb = .6+(clamp(fragColor.rgb,0.,1.)-.6);//*sig/(.1+abs(sig));
    
    fragColor.rgb = pow(fragColor.rgb,vec3(1./2.2));
    fragColor.a = 1.;
}
