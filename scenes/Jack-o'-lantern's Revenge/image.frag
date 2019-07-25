
//         _            _                _        _             _                  _     
//        | |          | |              ( )      | |           | |                ( )    
//        | | __ _  ___| | ________ ___ |/ ______| | __ _ _ __ | |_ ___ _ __ _ __ |/ ___ 
//    _   | |/ _` |/ __| |/ /______/ _ \  |______| |/ _` | '_ \| __/ _ \ '__| '_ \  / __|
//   | |__| | (_| | (__|   <      | (_) |        | | (_| | | | | ||  __/ |  | | | | \__ \
//    \____/ \__,_|\___|_|\_\      \___/         |_|\__,_|_| |_|\__\___|_|  |_| |_| |___/
//   |  __ \                                                                             
//   | |__) |_____   _____ _ __   __ _  ___                                              
//   |  _  // _ \ \ / / _ \ '_ \ / _` |/ _ \                                             
//   | | \ \  __/\ V /  __/ | | | (_| |  __/                                             
//   |_|  \_\___| \_/ \___|_| |_|\__, |\___|                                             
//                                __/ |                                                  
// @P_Malin
// https://www.shadertoy.com/view/Mt2yzK


//    _____                               _____                                _ _   _             
//   |_   _|                             / ____|                              (_) | (_)            
//     | |  _ __ ___   __ _  __ _  ___  | |     ___  _ __ ___  _ __   ___  ___ _| |_ _  ___  _ __  
//     | | | '_ ` _ \ / _` |/ _` |/ _ \ | |    / _ \| '_ ` _ \| '_ \ / _ \/ __| | __| |/ _ \| '_ \ 
//    _| |_| | | | | | (_| | (_| |  __/ | |___| (_) | | | | | | |_) | (_) \__ \ | |_| | (_) | | | |
//   |_____|_| |_| |_|\__,_|\__, |\___|  \_____\___/|_| |_| |_| .__/ \___/|___/_|\__|_|\___/|_| |_|
//                           __/ |                            | |                                  
//                          |___/                             |_|                                  

///////////////////////////////////////////////

vec3 Tonemap( vec3 x )
{
    float a = 0.010;
    float b = 0.132;
    float c = 0.010;
    float d = 0.163;
    float e = 0.101;

    return ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e );
}


vec3 ApplyGrain( vec2 vUV, vec3 col, float amount )
{
    float h = hash13( vec3(vUV, iTime) );
    
    col *= (h * 2.0 - 1.0) * amount + (1.0f -amount);
    
    return col;
}


float GetVignetting( const in vec2 vUV, float fScale, float fPower, float fStrength )
{
    vec2 vOffset = (vUV - 0.5) * sqrt(2.0) * fScale;
    
    float fDist = max( 0.0, 1.0 - length( vOffset ) );
    
    float fShade = 1.0 - pow( fDist, fPower );
    
    fShade = 1.0 - fShade * fStrength;

    return fShade;
}

vec3 ColorGrade( vec3 vColor )
{
    vec3 vHue = vec3(1.0, .7, .2);
    
    vec3 vGamma = 1.0 + vHue * 0.6;
    vec3 vGain = vec3(.9) + vHue * vHue * 8.0;
    
    vColor *= 1.5;
    
    float fMaxLum = 100.0;
    vColor /= fMaxLum;
    vColor = pow( vColor, vGamma );
    vColor *= vGain;
    vColor *= fMaxLum;  
    return vColor;
}

vec4 SampleBloom( vec2 vUV )
{
    vec2 gBloomSize = iResolution.xy / 4.0;//min( vec2(320.0, 240.0), iResolution.xy );
    
    vec4 vBloomSample = textureLod( iChannel1, vUV * gBloomSize / iResolution.xy, 0.0 ).rgba;
    
    return vBloomSample;
}


vec3 SampleImage( vec2 vUV, int image )
{
    if ( image >= 0 )
    {
        vUV.x *= 0.5;
    }
    
    if (image > 0 )
    {
        vUV.x += 0.5;
    }
    
    vec4 vImageSample = textureLod( iChannel0, vUV, 0.0 ).rgba;

    vec4 vBloomSample = SampleBloom( vUV );
    
    const float fBloomAmount = 0.025;
   
    return mix( vImageSample.rgb, vBloomSample.rgb, fBloomAmount );    
}

vec2 DistortUV( vec2 vUV, float f )
{
    vUV -= 0.5;

    float fScale = 0.0075;
    
    float r1 = 1. + f * fScale;
    
    vec3 v = vec3(vUV, sqrt( r1 * r1 - dot(vUV, vUV) ) );
    
    v = normalize(v);
    vUV = v.xy;
    
    
    vUV += 0.5;
    
    return vUV;
}

vec3 SampleImage2( vec2 vUV, vec2 vScreen, int image )
{
    vec3 a = SampleImage( DistortUV( vUV, 1.0 ), image );
    vec3 b = SampleImage( DistortUV( vUV, 0.0 ), image );
    vec3 c = SampleImage( DistortUV( vUV, -1.0 ), image );
    
    vec3 vResult = vec3(0);
    
    vec3 wa = vec3(1., .5, .1);
    vec3 wb = vec3(.5, 1., .5);
    vec3 wc = vec3(.1, .5, 1.);
    
    vResult += a * wa;
    vResult += b * wb;
    vResult += c * wc;
    
    vResult /= wa + wb + wc;
    
    return vResult;
}


void Process( out vec4 fragColor, vec2 vUV, vec2 vScreen, int image )
{
    vec3 vResult = SampleImage2( vUV, vScreen, image );
    
    //vResult = texelFetch( iChannel0, ivec2( fragCoord.xy ), 0 ).rgb;
    
    float fShade = GetVignetting( vUV, 0.7, 2.0, 1.0 );
    
    vResult *= fShade;
    
    //if ( vUV.x > sin(iTime)*0.5+0.5 )
    {
        vResult = ColorGrade( vResult );
    }
    
    vResult = ApplyGrain( vUV, vResult, 0.15 );      
    
    vec3 vFlare = 0.0
        + SampleBloom((vScreen)).rgb * 0.001
        + SampleBloom((vScreen - 0.5)*-0.5 + 0.5).rgb * 0.0005
        + SampleBloom((vScreen - 0.5)*-.9 + 0.5).rgb * 0.00025
        + SampleBloom((vScreen - 0.5)*0.2 + 0.5).rgb * 0.000125
        ;
    
    vec3 vFlareTex = texture( iChannel2, vScreen ).rgb;
    vResult += vFlare;
    
    //vResult = vFlare * 10.0;
    
    
    vResult = vResult * 1.5;
    vResult = Tonemap( vResult );
    fragColor.rgb = vResult;
    fragColor.a = 1.0;    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 vUV = fragCoord.xy / iResolution.xy;
    
    Process( fragColor, vUV, vUV, -1 );       
}

void mainVR( out vec4 vFragColor, in vec2 vFragCoord, in vec3 vRayOrigin, in vec3 vRayDir )
{
    vec2 vScreen = vFragCoord.xy / iResolution.xy;
    vec2 vUV = vScreen;
    
    int image = 0;
    
    if (vUV.x > 0.5 )
    {
        image = 1;
    }
    
    vUV.x = fract( vUV.x * 2.0 );
    
    Process( vFragColor, vUV, vScreen, image );    
}

