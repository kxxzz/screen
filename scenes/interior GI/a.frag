#define FASTER_BUT_UGLIER 1

float hash(in float x)
{
    return fract(sin(13.15*x)*932.3);
}

vec3 cosine_distrib(in vec3 n, in vec2 uv)
{
    vec3 x;
    if (abs(n.y) > 0.99)
    {
        x = normalize(cross(n, vec3(0, 0, 1)));
    }
    else
    {
        x = normalize(cross(vec3(0, 1, 0), n));
    }
    vec3 y = cross(n, x);
    
    float theta = 3.1415926 * 2.0 * uv.x;
    float r = sqrt(uv.y);
    vec3 ray = x * r * cos(theta) + y * r * sin(theta) + n * sqrt(1.0 - r*r);
    
    return ray;
}

float ubox(vec3 p, vec3 b)
{
  return length(max(abs(p)-b,0.0));
}

float box(vec3 p, vec3 b)
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

#define GROUND_ID 0
#define LIGHT_BULB_ID 1
#define TABLE_ID 2
#define ROOM_ID 3

float scene(in vec3 p, out int id)
{  
    float light_bulb = length(p - vec3(4.25, 4.2, 0)) - 2.0;
    float ground = p.y;
    float room = max(-box(p - vec3(1.8, 1, 3), vec3(0.5, 0.9, 1)), max(box(p - vec3(0, 1, 0), vec3(3, 2, 2.7)), -box(p - vec3(0, 1, 0), 0.8*vec3(3, 2, 3))));
    float table = box(p - vec3(1.9, 0.6, 0.8), vec3(0.5, 0.05, 0.6));
    float leg1 = box(p - vec3(1.45, 0.3, 1.35), vec3(0.05, 0.3, 0.05));
    float leg2 = box(p - vec3(2.35, 0.3, 1.35), vec3(0.05, 0.3, 0.05));
    float leg3 = box(p - vec3(1.45, 0.3, 0.25), vec3(0.05, 0.3, 0.05));
    float leg4 = box(p - vec3(2.35, 0.3, 0.25), vec3(0.05, 0.3, 0.05));
    table = min(min(min(min(table, leg1), leg2), leg3), leg4);
    float d = min(table, min(room, min(light_bulb, ground)));
    
    if (d == light_bulb)
    {
        id = LIGHT_BULB_ID;
    }
    else if (d == ground)
    {
        id = GROUND_ID;
    }
    else if (d == table)
    {
        id = TABLE_ID;
    }
    else if (d == room)
    {
    id = ROOM_ID;
    }
    else
    {
        id = -1;
    }
    
    return d;
}

float hash3(in vec3 p)
{
    return hash(dot(p, vec3(91.3, 151.16, 72.15)));
}

float noise(in vec3 p)
{
    vec3 ipos = floor(p);
    vec3 fpos = fract(p);
    
    float a = hash3(ipos + vec3(0, 0, 0));
    float b = hash3(ipos + vec3(1, 0, 0));
    float c = hash3(ipos + vec3(0, 1, 0));
    float d = hash3(ipos + vec3(1, 1, 0));
    float e = hash3(ipos + vec3(0, 0, 1));
    float f = hash3(ipos + vec3(1, 0, 1));
    float g = hash3(ipos + vec3(0, 1, 1));
    float h = hash3(ipos + vec3(1, 1, 1));
    
    vec3 t = smoothstep(vec3(0), vec3(1), fpos);
    
    return mix(mix(mix(a, b, t.x), mix(c, d, t.x), t.y),
               mix(mix(e, f, t.x), mix(g, h, t.x), t.y),
               t.z);
}

float fbm(in vec3 p)
{
    float res = 0.0;
    float amp = 0.5;
    float freq = 2.0;
    for (int i = 0; i < 6; ++i)
    {
        res += amp*noise(freq*p);
        amp *= 0.5;
        freq *= 2.0;
    }
    return res;
}

struct material
{
    vec3 albedo;
    vec3 emission;
};
    
material mat_lookup(in vec3 p, int id)
{
    material mat;
    
    if (id == GROUND_ID)
    {
        if (dot(p,p) > 3.5*3.5)
        {
            mat = material(vec3(0.5), vec3(0));
        }
        else
        {
            vec3 col1 = vec3(0.33, 0.18, 0.09);
            vec3 col2 = 0.3*vec3(0.33, 0.18, 0.09);
            mat = material(mix(col1, col2, fbm(vec3(p.x, p.y, 10.0*p.z))), vec3(0));
        }
    }
    else if (id == LIGHT_BULB_ID)
    {
        mat = material(vec3(0.5), vec3(0.000001));
    }
    else if (id == ROOM_ID)
    {
        vec3 col1 = vec3(0.8, 0.4, 0.2);
        vec3 col2 = 0.7*col1;
        mat = material(mix(col1, col2, fbm(p)), vec3(0));
    }
    else if (id == TABLE_ID)
    {
        mat = material(vec3(0.9), vec3(0));
    }
    else
    {
        mat = material(vec3(1.0, 0.0, 1.0), vec3(0));
    }
    
    return mat;
}

vec3 scene_n(in vec3 p)
{
    int id;
    vec2 e = vec2(0, 0.001);
    return normalize(vec3(scene(p + e.yxx, id) - scene(p - e.yxx, id), scene(p + e.xyx, id) - scene(p - e.xyx, id), scene(p + e.xxy, id) - scene(p - e.xxy, id)));
}

float intersect(in vec3 ro, in vec3 rd, out int id)
{    
    id = -1;
    int ignore;
    float t = 2.0 * max(0.03, scene(ro, ignore));
    float t_max = 50.0;
    
#if !(FASTER_BUT_UGLIER)
    for (int i = 0; i < 256; ++i)
    {
        if (t > t_max) break;
        
        int curr_id;
        float d = scene(ro + t*rd, curr_id);
        if (d < 0.01)
        {
            id = curr_id;
            break;
        }
        
        t += d;
    } 
#else
    float relax = 1.5;
    float last_d = 0.0;
    float last_dt = 0.0;
    for (int i = 0; i < 256; ++i)
    {
        if (t > t_max) break;
        
        int curr_id;
        float d = scene(ro + t*rd, curr_id);
        
        //test for overrelaxation
        if (relax != 1.0 && last_dt > abs(last_d) + abs(d))
        {
            //if overrelaxed, turn off relaxation and step back
            t += (1.0 - relax) * last_dt;
            relax = 1.0;
            continue;
        }
        
        if (d < 0.005)
        {
            id = curr_id;
            break;
        }        
        t += relax * d;
        last_dt = relax * d;
        last_d = d;
    } 
#endif
    
    return t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    vec3 prev_col = texture(iChannel0, uv).rgb;
    
    vec2 jitter = 1.0 - 2.0 * vec2(hash(uv.x * 15.9 + uv.y * 81.35 + 81.3*iTime), 
                               hash(uv.x * 91.1 + uv.y * 13.5 + 51.7*iTime));
    uv = (fragCoord + 0.5*jitter) / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    vec3 at = vec3(0, 1, 0.9);
    vec3 ro = vec3(-1, 1, 0.5);
    vec3 cam_z = normalize(at - ro);
    vec3 cam_x = normalize(cross(vec3(0,1,0), cam_z));
    vec3 cam_y = cross(cam_z, cam_x);
    vec3 rd = normalize(uv.x * cam_x + uv.y * cam_y + 2.0 * cam_z);
    
    vec3 sky = vec3(10);
    vec3 col = vec3(0.0);
    vec3 atten = vec3(1);
    for (int bounce_i = 0; bounce_i < 8; ++bounce_i)
    {        
      int id;
      float t = intersect(ro, rd, id);

        if (id != -1)
        {
          vec3 p = ro + t*rd;
            vec3 n = scene_n(p);
            
            material mat = mat_lookup(p, id);
            col += atten * mat.emission;
            atten *= mat.albedo;
            
            ro = p;
            vec2 uv = vec2(hash(15.1*ro.x + 29.7*ro.y + 11.6*ro.z + 9.1*float(bounce_i) + 91.3*iTime),
                           hash(23.7*ro.x + 11.3*ro.y + 23.7*ro.z + 15.3*float(bounce_i) + 32.1*iTime));
            rd = cosine_distrib(n, uv);
        }
        else
        {
            col = atten * sky;
            break;
        }
    }
    
    float frame_count = float(iFrame) + 1.0;
    float prev_weight = (frame_count - 1.0) / frame_count;
    float curr_weight = 1.0 - prev_weight;
    fragColor = vec4(prev_weight * prev_col + curr_weight * col, 1.0);
}

