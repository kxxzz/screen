#define saturate(x) clamp(x, 0.0, 1.0)

vec3 Debug(float t)
{
    vec3 c = vec3(0.478, 0.500, 0.500);
    c += .5 * cos(6.28318 * (vec3(0.688, 0.748, 0.748) * t + vec3(0.318, 0.588, 0.908)));
    return clamp(c, vec3(0.0), vec3(1.0));
}

struct Intersection
{
    float totalDistance;
    float sdf;
    int materialID;
};

struct Ray
{
    vec3 origin;
    vec3 direction;
};

struct Camera
{
    vec3 position;
    vec3 direction;
};
    
Camera LoadCamera(sampler2D tex)
{
    Camera cam;
    cam.position = texelFetch(tex, ivec2(0,0), 0).rgb;
    cam.direction = normalize(texelFetch(tex, ivec2(0,1), 0).rgb);
    return cam;
}

Ray GetRay(Camera cam, vec2 uv, float zoom, float time)
{
    vec3 forward = normalize(cam.direction);
    vec3 left = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = normalize(cross(forward, left));

    Ray ray;   
    ray.origin = cam.position;
    ray.direction = normalize(forward - left * uv.x * zoom - up * uv.y * zoom);        
    return ray;
}

